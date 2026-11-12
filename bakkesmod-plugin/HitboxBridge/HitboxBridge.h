#pragma once

#include <string>

#include "bakkesmod/plugin/bakkesmodplugin.h"
#include "bakkesmod/wrappers/wrapperstructs.h"

/**
 * HITBOX bridge plugin.
 *
 * Reads the live loadout written by the HITBOX desktop app from
 * <bakkesmod folder>\hitbox_live.txt and applies it client-side:
 *  - Body / boost items through LoadoutUtilities::ForceSetLoadout.
 *  - Primary / secondary paint colours through SetLoadoutPaintFinishColors,
 *    which accepts a real LinearColor override, so any colour the user picks
 *    in the app shows up in game exactly as picked.
 *
 * In freeplay / offline training the applied body is the real body, so the
 * car the user sees is the car they drive, hitbox included. In online
 * matches the server still owns the hitbox; only the visuals change.
 */
class HitboxBridge : public BakkesMod::Plugin::BakkesModPlugin
{
public:
	void onLoad() override;
	void onUnload() override;

private:
	struct LiveFile
	{
		bool enabled = false;
		int bodyProductId = 0;
		int boostProductId = 0;
		LinearColor primary{};
		LinearColor secondary{};
		bool primarySet = false;
		bool secondarySet = false;
		bool asIs = false;
		long revision = 0;
	};

	void ScheduleNextTick();
	void ReloadFile();
	void ApplyOnce(bool notifyOnError);
	void DumpLoadout();
	void WriteBridgeStatus();

	static bool ParseHexColor(const std::string& text, LinearColor& out);
	static long NowMs();
	std::string BakkesModFolder() const;
	std::string LiveFilePath() const;
	std::string DumpPath() const;

	LiveFile live_{};
	long loadedRevision_ = -1;
	long lastAppliedRevision_ = -1;
};
