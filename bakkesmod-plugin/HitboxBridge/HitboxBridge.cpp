#include "HitboxBridge.h"

#include <chrono>
#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

#include "bakkesmod/wrappers/GameObject/CarWrapper.h"
#include "bakkesmod/wrappers/GameObject/PriWrapper.h"
#include "bakkesmod/wrappers/PlayerControllerWrapper.h"
#include "bakkesmod/core/loadout_structs.h"
#include "bakkesmod/utilities/LoadoutUtilities.h"

BAKKESMOD_PLUGIN(HitboxBridge, "HITBOX bridge", "1.0", PLUGINTYPE_ALL)

using namespace BakkesMod::Plugin;

namespace
{
	constexpr const char* LIVE_FILE_NAME = "hitbox_live.txt";
	constexpr const char* DUMP_FILE_NAME = "hitbox_dump.txt";
	constexpr const char* BRIDGE_FILE_NAME = "hitbox_bridge.txt";
	constexpr float APPLY_TICK_SECONDS = 2.0f;

	std::string Trim(const std::string& value)
	{
		const size_t start = value.find_first_not_of(" \t\r\n");
		if (start == std::string::npos) return {};
		const size_t end = value.find_last_not_of(" \t\r\n");
		return value.substr(start, end - start + 1);
	}

	bool ParseInt(const std::string& text, long& out)
	{
		try
		{
			size_t index = 0;
			out = std::stol(text, &index);
			return index == text.size();
		}
		catch (...)
		{
			return false;
		}
	}

	char Nibble(char c)
	{
		if (c >= '0' && c <= '9') return static_cast<char>(c - '0');
		if (c >= 'a' && c <= 'f') return static_cast<char>(c - 'a' + 10);
		if (c >= 'A' && c <= 'F') return static_cast<char>(c - 'A' + 10);
		return -1;
	}
}

void HitboxBridge::onLoad()
{
	cvarManager->registerNotifier("hitbox_reload", [this](const std::vector<std::string>&) {
		ReloadFile();
		cvarManager->log("[HITBOX] live file reloaded (rev " + std::to_string(live_.revision) + ").");
	});
	cvarManager->registerNotifier("hitbox_apply", [this](const std::vector<std::string>&) {
		ApplyOnce(true);
	});
	cvarManager->registerNotifier("hitbox_tick", [this](const std::vector<std::string>&) {
		ReloadFile();
		ApplyOnce(false);
		ScheduleNextTick();
	});
	cvarManager->registerNotifier("hitbox_dumploadout", [this](const std::vector<std::string>&) {
		DumpLoadout();
	});

	// Re-apply whenever the game hands out a fresh loadout (car spawn, team
	// change, map load). The tick loop keeps respawns in freeplay covered.
	gameWrapper->HookEvent("Function TAGame.PRI_TA.OnLoadoutsSetInternal",
		[this](void) { ApplyOnce(false); });
	gameWrapper->HookEvent("Function TAGame.Car_TA.SetTeam",
		[this](void) { ReloadFile(); ApplyOnce(false); });

	ReloadFile();
	WriteBridgeStatus();
	ScheduleNextTick();
	cvarManager->log("[HITBOX] bridge loaded.");
}

void HitboxBridge::onUnload()
{
}

void HitboxBridge::ScheduleNextTick()
{
	gameWrapper->SetTimeout(
		[this](GameWrapper*) { cvarManager->executeCommand("hitbox_tick", true); },
		APPLY_TICK_SECONDS);
}

std::string HitboxBridge::BakkesModFolder() const
{
	const std::filesystem::path folder = gameWrapper->GetBakkesModPath();
	return folder.string();
}

std::string HitboxBridge::LiveFilePath() const
{
	return BakkesModFolder() + "\\" + LIVE_FILE_NAME;
}

std::string HitboxBridge::DumpPath() const
{
	return BakkesModFolder() + "\\" + DUMP_FILE_NAME;
}

void HitboxBridge::WriteBridgeStatus()
{
	std::ofstream out(BakkesModFolder() + "\\" + BRIDGE_FILE_NAME, std::ios::trunc);
	if (!out.good()) return;
	out << "bmfolder=" << BakkesModFolder() << "\n";
	out << "version=1.0\n";
	out << "updated=" << NowMs() << "\n";
}

long HitboxBridge::NowMs()
{
	return static_cast<long>(
		std::chrono::duration_cast<std::chrono::milliseconds>(
			std::chrono::system_clock::now().time_since_epoch())
			.count());
}

bool HitboxBridge::ParseHexColor(const std::string& text, LinearColor& out)
{
	std::string hex = text;
	if (!hex.empty() && (hex[0] == '#' || hex[0] == '$')) hex = hex.substr(1);
	if (hex.size() != 6 && hex.size() != 8) return false;
	if (hex.size() == 6) hex += "ff";
	for (const char c : hex)
	{
		if (Nibble(c) < 0) return false;
	}
	const int r = (Nibble(hex[0]) << 4) | Nibble(hex[1]);
	const int g = (Nibble(hex[2]) << 4) | Nibble(hex[3]);
	const int b = (Nibble(hex[4]) << 4) | Nibble(hex[5]);
	const int a = (Nibble(hex[6]) << 4) | Nibble(hex[7]);
	out = LinearColor(r / 255.0f, g / 255.0f, b / 255.0f, a / 255.0f);
	return true;
}

void HitboxBridge::ReloadFile()
{
	LiveFile parsed;
	std::ifstream file(LiveFilePath());
	if (!file.good())
	{
		if (loadedRevision_ != -1) cvarManager->log("[HITBOX] live file gone; bridge paused.");
		loadedRevision_ = -1;
		live_ = LiveFile{};
		return;
	}

	std::string line;
	while (std::getline(file, line))
	{
		const size_t eq = line.find('=');
		if (eq == std::string::npos) continue;
		const std::string key = Trim(line.substr(0, eq));
		const std::string value = Trim(line.substr(eq + 1));
		long number = 0;
		if (key == "enabled")
		{
			parsed.enabled = value == "1" || value == "true";
		}
		else if (key == "body")
		{
			if (ParseInt(value, number)) parsed.bodyProductId = static_cast<int>(number);
		}
		else if (key == "boost")
		{
			if (ParseInt(value, number)) parsed.boostProductId = static_cast<int>(number);
		}
		else if (key == "primary")
		{
			parsed.primarySet = ParseHexColor(value, parsed.primary);
		}
		else if (key == "secondary")
		{
			parsed.secondarySet = ParseHexColor(value, parsed.secondary);
		}
		else if (key == "asis")
		{
			parsed.asIs = value == "1" || value == "true";
		}
		else if (key == "rev")
		{
			if (ParseInt(value, number)) parsed.revision = number;
		}
	}

	if (parsed.revision != live_.revision)
	{
		cvarManager->log("[HITBOX] live file changed to rev " + std::to_string(parsed.revision));
	}
	loadedRevision_ = parsed.revision;
	live_ = parsed;
}

void HitboxBridge::ApplyOnce(bool notifyOnError)
{
	if (!live_.enabled) return;
	if (live_.revision == lastAppliedRevision_) return;
	if (gameWrapper->IsInReplay()) return;
	if (!gameWrapper->IsInGame() && !gameWrapper->IsInFreeplay()) return;

	CarWrapper car = gameWrapper->GetLocalCar();
	if (!car)
	{
		if (notifyOnError) cvarManager->log("[HITBOX] no local car yet; will retry on the next tick.");
		return;
	}

	PlayerControllerWrapper controller = gameWrapper->GetPlayerController();
	if (!controller) return;
	PriWrapper pri = controller.GetPRI();
	if (!pri) return;

	pluginsdk::Loadout loadout{};
	if (live_.bodyProductId > 0)
	{
		loadout.items[pluginsdk::Equipslot::BODY] = pluginsdk::ItemData{
			pluginsdk::Equipslot::BODY, live_.bodyProductId, {},
		};
	}
	if (live_.boostProductId > 0)
	{
		loadout.items[pluginsdk::Equipslot::ROCKETBOOST] = pluginsdk::ItemData{
			pluginsdk::Equipslot::ROCKETBOOST, live_.boostProductId, {},
		};
	}

	if (!live_.asIs && (live_.primarySet || live_.secondarySet))
	{
		pluginsdk::CarColors colors{};
		colors.team_paint = pluginsdk::TeamPaint{0, 255, 255};
		if (live_.primarySet) colors.team_color_override = live_.primary;
		if (live_.secondarySet) colors.custom_color_override = live_.secondary;
		LoadoutUtilities::SetLoadoutPaintFinishColors(car, colors);
	}

	if (live_.bodyProductId > 0 || live_.boostProductId > 0)
	{
		LoadoutUtilities::ForceSetLoadout(pri, loadout);
	}

	lastAppliedRevision_ = live_.revision;
	cvarManager->log("[HITBOX] applied rev " + std::to_string(live_.revision));
}

void HitboxBridge::DumpLoadout()
{
	if (!gameWrapper->IsInGame() && !gameWrapper->IsInFreeplay()) return;
	CarWrapper car = gameWrapper->GetLocalCar();
	if (!car) return;
	PlayerControllerWrapper controller = gameWrapper->GetPlayerController();
	if (!controller) return;
	PriWrapper pri = controller.GetPRI();
	if (!pri) return;

	const std::optional<pluginsdk::Loadout> current = LoadoutUtilities::GetLoadoutFromPri(pri, 0);
	if (!current.has_value())
	{
		cvarManager->log("[HITBOX] could not read the current loadout.");
		return;
	}

	std::ofstream out(DumpPath(), std::ios::trunc);
	if (!out.good())
	{
		cvarManager->log("[HITBOX] could not write " + DumpPath());
		return;
	}
	out << "# Equipped loadout dump for the HITBOX app, one line per slot.\n";
	for (const auto& entry : current->items)
	{
		out << "slot=" << static_cast<int>(entry.first) << " product=" << entry.second.product_id
			<< "\n";
	}
	out.flush();
	out.close();
	cvarManager->log("[HITBOX] loadout dumped to " + DumpPath());
}
