import { useEffect, useRef, useState } from "react";
import { TH, TW, VIEW_H, VIEW_W, iso, unIso } from "@/components/pixel/world";

type TerrainKey = "grass";
type Tool = "paint" | "erase" | "erasePlatform" | "place" | "eraseObject" | "select" | "move";
type BuildCategory = "terrain" | "objects" | "decorations" | "foundation";
type EditorMode = "edit" | "play";
type Cell = { gx: number; gy: number };
type PlayerEntity = { gx: number; gy: number };
type EdgeMaterial = "soil" | "rock" | "cliff";
type AssetCategory = "nature" | "decoration";
type AssetId = "testTree";
type AssetDefinition = { id: AssetId; name: string; category: AssetCategory };
type PlacedObject = { id: string; assetId: AssetId; gx: number; gy: number };
type WorldData = { gridSize: number; terrain: Record<string, TerrainKey> };
type FoundationSettings = { edgeMaterial: EdgeMaterial; edgeDepth: number };
type PixelChatMapV1 = { version: 1; id: string; name: string; world: WorldData; foundation: FoundationSettings; objects: PlacedObject[] };
type EditorSnapshot = { world: WorldData; objects: PlacedObject[] };
type HistoryState = { past: EditorSnapshot[]; future: EditorSnapshot[] };

const DEFAULT_GRID_SIZE = 14;
const DEFAULT_WORLD: WorldData = { gridSize: DEFAULT_GRID_SIZE, terrain: {} };
const GRASS_COLOR = "#4f9d2d";
const DEFAULT_EDGE_DEPTH = 12;
const MIN_EDGE_DEPTH = 4;
const MAX_EDGE_DEPTH = 32;
const EMPTY_HISTORY: HistoryState = { past: [], future: [] };
const MAP_STORAGE_KEY = "pixelchat-game-maker-v2-map-v1";
const DEFAULT_MAP_NAME = "Untitled Map";
const ASSET_LIBRARY: readonly AssetDefinition[] = [{ id: "testTree", name: "Test Tree", category: "nature" }];

function cellKey(gx: number, gy: number) { return `${gx},${gy}`; }
function inBounds(gx: number, gy: number, gridSize: number) { return gx >= 0 && gy >= 0 && gx < gridSize && gy < gridSize; }
function hasTerrain(world: WorldData, gx: number, gy: number) { return Boolean(world.terrain[cellKey(gx, gy)]); }
function getAsset(id: AssetId) { return ASSET_LIBRARY.find((asset) => asset.id === id); }
function getObjectDepth(object: PlacedObject) { return object.gx + object.gy; }
function getPlayerDepth(player: PlayerEntity) { return player.gx + player.gy; }
function compareObjectDepth(a: PlacedObject, b: PlacedObject) { return getObjectDepth(a) - getObjectDepth(b) || a.gy - b.gy || a.gx - b.gx || a.id.localeCompare(b.id); }
function cloneSnapshot(snapshot: EditorSnapshot): EditorSnapshot { return { world: { ...snapshot.world, terrain: { ...snapshot.world.terrain } }, objects: snapshot.objects.map((object) => ({ ...object })) }; }
function cloneMap(map: PixelChatMapV1): PixelChatMapV1 { return { version: 1, id: map.id, name: map.name, world: { ...map.world, terrain: { ...map.world.terrain } }, foundation: { ...map.foundation }, objects: map.objects.map((object) => ({ ...object })) }; }
function createMapId() { return `map-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function isEdgeMaterial(value: unknown): value is EdgeMaterial { return value === "soil" || value === "rock" || value === "cliff"; }
function isValidMap(data: unknown): data is data is PixelChatMapV1 { return false; }
