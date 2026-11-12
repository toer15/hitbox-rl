import { useEffect, useMemo, useState } from 'react';
import type { MapCategory, MapDifficulty } from '../types';
import { MAP_CATEGORIES, WORKSHOP_MAPS, mapWorkshopUrl } from '../data';
import { launchGame, openExternal, openMapsFolder } from '../lib/desktop';
import { Icon } from './Icons';

interface MapBrowserProps {
  onNotify: (message: string, kind?: 'ok' | 'error') => void;
}

type SortMode = 'featured' | 'name' | 'size' | 'difficulty';

const FAVORITES_KEY = 'hitbox.mapFavorites.v1';

const CATEGORY_COLOR: Record<MapCategory, string> = {
  Dribbling: '#C6F65A',
  Rings: '#3F9BFF',
  Parkour: '#FF9B3D',
  Training: '#A978FF',
  Race: '#21D4B4',
  'Mini-game': '#FF5F8F',
  Remake: '#8FA8FF',
};

const DIFFICULTY_COLOR: Record<MapDifficulty, string> = {
  Beginner: '#7DD3FC',
  Intermediate: '#C6F65A',
  Advanced: '#FFB84D',
  Extreme: '#FF6B7A',
};

const DIFFICULTY_ORDER: Record<MapDifficulty, number> = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Extreme: 3,
};

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const CUSTOM_MAPS_KEY = 'hitbox.customMaps.v1';

interface CustomMap {
  id: string;
  name: string;
  author: string;
  sizeMB: number;
  description: string;
}

function readCustomMaps(): CustomMap[] {
  try {
    const raw = window.localStorage.getItem(CUSTOM_MAPS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is CustomMap => Boolean(item?.id && item?.name)) : [];
  } catch {
    return [];
  }
}

export function MapBrowser({ onNotify }: MapBrowserProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | MapCategory>('All');
  const [difficulty, setDifficulty] = useState<'All' | MapDifficulty>('All');
  const [sort, setSort] = useState<SortMode>('featured');
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [customMaps, setCustomMaps] = useState<CustomMap[]>(readCustomMaps);
  const [workshopInput, setWorkshopInput] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(CUSTOM_MAPS_KEY, JSON.stringify(customMaps));
  }, [customMaps]);

  const handleWorkshopAdd = async () => {
    const raw = workshopInput.trim();
    if (!raw) return;
    const match = raw.match(/(?:id|\?id=|=|\/)(\d{5,12})/) ?? raw.match(/^(\d{5,12})$/);
    const id = match ? match[1] : raw.replace(/\D/g, '');
    if (!id || !/^\d{5,12}$/.test(id)) {
      onNotify('Paste a Steam Workshop link or item number.', 'error');
      return;
    }
    if (customMaps.some((entry) => entry.id === id) || WORKSHOP_MAPS.some((entry) => entry.id === id)) {
      onNotify('That map is already in your list.');
      setWorkshopInput('');
      return;
    }
    setLookingUp(true);
    try {
      const result = await window.hitboxDesktop?.lookupWorkshopMap(id);
      if (!result?.ok || !result.map) {
        onNotify(result?.error ?? 'Could not fetch that workshop item.', 'error');
        return;
      }
      setCustomMaps((current) => [
        {
          id: String(result.map!.id),
          name: result.map!.name,
          author: result.map!.author,
          sizeMB: result.map!.sizeMB,
          description: result.map!.description,
        },
        ...current,
      ]);
      setWorkshopInput('');
      onNotify(`Added “${result.map.name}” to your maps.`);
    } finally {
      setLookingUp(false);
    }
  };

  useEffect(() => {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites]);

  const allMaps = useMemo(
    () => [
      ...customMaps.map((entry) => ({
        id: entry.id,
        name: entry.name,
        author: entry.author,
        category: 'Training' as MapCategory,
        difficulty: 'Intermediate' as MapDifficulty,
        players: '1+',
        sizeMB: entry.sizeMB,
        description: entry.description || 'Added from the Steam Workshop.',
        featured: false,
      })),
      ...WORKSHOP_MAPS,
    ],
    [customMaps],
  );

  const maps = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = allMaps.filter((map) => {
      if (category !== 'All' && map.category !== category) return false;
      if (difficulty !== 'All' && map.difficulty !== difficulty) return false;
      if (!search) return true;
      return (
        map.name.toLowerCase().includes(search) ||
        map.author.toLowerCase().includes(search) ||
        map.description.toLowerCase().includes(search)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.sizeMB - a.sizeMB;
      if (sort === 'difficulty') return DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty];
      return Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.name.localeCompare(b.name);
    });
  }, [category, difficulty, query, sort]);

  const toggleFavorite = (id: string) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const openMap = async (id: string) => {
    const result = await openExternal(mapWorkshopUrl(id));
    if (!result.ok) onNotify(result.error ?? 'Could not open Steam.', 'error');
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      onNotify(`Workshop ID ${id} copied.`);
    } catch {
      onNotify(`Workshop ID: ${id}`);
    }
  };

  const handleFolder = async () => {
    const result = await openMapsFolder();
    if (result.ok) onNotify('Opened the Rocket League workshop folder.');
    else onNotify(result.error ?? 'Could not find the workshop folder.', 'error');
  };

  const handleLaunch = async () => {
    const result = await launchGame();
    if (result.ok) onNotify('Opening Rocket League…');
    else onNotify(result.error ?? 'Could not launch Rocket League.', 'error');
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('All');
    setDifficulty('All');
    setSort('featured');
  };

  return (
    <div className="maps">
      <section className="panel maps-head">
        <div className="maps-title-block">
          <div className="eyebrow">
            <b>07</b> Workshop maps
          </div>
          <h2>Custom maps, no scavenger hunt.</h2>
          <p>
            A curated shelf of the workshop maps people actually play — dribble courses, rings, parkour, races and
            mini-games. Every entry links straight to its real Steam Workshop page.
          </p>
        </div>
        <div className="maps-head-actions">
          <button className="btn" onClick={handleFolder}>
            <Icon name="folder" size={15} /> Open map folder
          </button>
          <button className="btn" onClick={handleLaunch}>
            <Icon name="play" size={15} /> Launch RL
          </button>
          <button
            className="btn ghost"
            onClick={() => openExternal('https://steamcommunity.com/app/252950/workshop/')}
          >
            <Icon name="external" size={14} /> Steam Workshop
          </button>
        </div>
      </section>

      <section className="panel map-toolbar">
        <div className="map-search-row">
          <div className="search map-search">
            <Icon name="search" size={15} className="search-icon" />
            <input
              className="input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search maps, authors, mechanics…"
              aria-label="Search workshop maps"
            />
          </div>
          <select
            className="input select sort-select"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            aria-label="Sort maps"
          >
            <option value="featured">Featured first</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest first</option>
            <option value="difficulty">Easiest first</option>
          </select>
          <button className="btn ghost small" onClick={resetFilters}>
            Reset
          </button>
        </div>
        <div className="map-search-row">
          <div className="search map-search">
            <Icon name="external" size={15} className="search-icon" />
            <input
              className="input"
              value={workshopInput}
              onChange={(event) => setWorkshopInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleWorkshopAdd();
              }}
              placeholder="Paste any Steam Workshop map link or ID to add it…"
              aria-label="Add a workshop map by link"
            />
          </div>
          <button
            className="btn small"
            disabled={lookingUp || !workshopInput.trim()}
            onClick={() => void handleWorkshopAdd()}
          >
            <Icon name="download" size={13} /> {lookingUp ? 'Fetching…' : 'Add map'}
          </button>
        </div>

        <div className="map-filters">
          <div className="filter-line">
            <span className="filter-label">Type</span>
            <div className="filters">
              <button className={`chip ${category === 'All' ? 'active' : ''}`} onClick={() => setCategory('All')}>
                All
              </button>
              {MAP_CATEGORIES.map((entry) => (
                <button
                  key={entry}
                  className={`chip ${category === entry ? 'active' : ''}`}
                  onClick={() => setCategory(entry)}
                >
                  <i className="dot" style={{ background: CATEGORY_COLOR[entry] }} />
                  {entry}
                </button>
              ))}
            </div>
          </div>
          <div className="filter-line">
            <span className="filter-label">Difficulty</span>
            <div className="filters">
              <button className={`chip ${difficulty === 'All' ? 'active' : ''}`} onClick={() => setDifficulty('All')}>
                Any
              </button>
              {(Object.keys(DIFFICULTY_ORDER) as MapDifficulty[]).map((entry) => (
                <button
                  key={entry}
                  className={`chip ${difficulty === entry ? 'active' : ''}`}
                  onClick={() => setDifficulty(entry)}
                >
                  <i className="dot" style={{ background: DIFFICULTY_COLOR[entry] }} />
                  {entry}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="map-results-bar">
        <span>
          {maps.length} {maps.length === 1 ? 'map' : 'maps'}
        </span>
        <span className="map-results-note">{favorites.length} starred</span>
      </div>

      <div className="map-grid">
        {maps.map((map) => {
          const starred = favorites.includes(map.id);
          return (
            <article className={`panel map-card ${map.featured ? 'featured' : ''}`} key={map.id}>
              <div className="map-card-top">
                <span className="map-tag" style={{ color: CATEGORY_COLOR[map.category], borderColor: `${CATEGORY_COLOR[map.category]}55` }}>
                  {map.category}
                </span>
                <div className="map-card-tools">
                  {map.featured && <span className="featured-tag">PICK</span>}
                  <button
                    className={`icon-btn star-btn ${starred ? 'on' : ''}`}
                    onClick={() => toggleFavorite(map.id)}
                    aria-label={starred ? `Unstar ${map.name}` : `Star ${map.name}`}
                    aria-pressed={starred}
                    title={starred ? 'Remove from starred' : 'Star map'}
                  >
                    <Icon name="star" size={15} />
                  </button>
                </div>
              </div>
              <h3>{map.name}</h3>
              <div className="map-author">by {map.author}</div>
              <p>{map.description}</p>
              <div className="map-meta">
                <span className="meta-pill" style={{ color: DIFFICULTY_COLOR[map.difficulty] }}>
                  {map.difficulty}
                </span>
                <span className="meta-pill">{map.players}P</span>
                <span className="meta-pill">{map.sizeMB ? `${map.sizeMB} MB` : 'Size N/A'}</span>
              </div>
              <div className="map-actions">
                <button className="btn small primary" onClick={() => openMap(map.id)}>
                  <Icon name="external" size={13} /> Steam
                </button>
                <button className="btn small ghost" onClick={() => copyId(map.id)}>
                  <Icon name="copy" size={13} /> ID
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {maps.length === 0 && (
        <div className="panel empty-state">
          <Icon name="map" size={26} />
          <h3>No maps match those filters</h3>
          <p>Loosen the search or reset filters.</p>
          <button className="btn" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      )}

      <p className="data-note">
        {WORKSHOP_MAPS.length} maps catalogued. Steam hosts thousands more — Hitbox keeps a working shelf, not a mirror
        of the entire workshop. Sizes come from the workshop listing.
      </p>
    </div>
  );
}
