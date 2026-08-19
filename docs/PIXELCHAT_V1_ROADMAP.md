# PixelChat V1 Roadmap

## Product core
PixelChat is a social multiplayer pixel world.

The V1 loop is simple:
1. Log in
2. Join a room
3. See real players
4. Click to walk
5. Chat
6. Meet people

## Phase 1 - Stabilize the core
- Keep the original `/` PixelChat experience as the primary product.
- Remove experimental character/nature test routes from the active app surface.
- Keep the current simple retro characters for now.
- Do not add more complex sprite directions or animation systems.
- Split the large `PixelChat.tsx` over time, but only after behavior is covered and stable.

## Phase 2 - Real multiplayer
- Player identity/session
- Join and leave rooms
- Real-time player presence
- Real-time movement
- Real-time global and room chat
- Online player count
- Basic reconnect handling

## Phase 3 - Social features
- Click a player to open a profile
- Friends
- Direct messages
- Nearby chat
- Whisper
- Block and report
- Presence and notifications

## Phase 4 - Simple customization
- Small set of avatar styles
- Hair options
- Outfit options
- Color variants
- Cosmetic unlocks

Keep avatars intentionally simple. Do not return to the previous 8-direction sprite project unless there is a clear product reason.

## Phase 5 - Progression
- XP based on meaningful activity
- Levels
- Badges
- Achievements
- Cosmetic rewards

## Phase 6 - Rooms and events
Initial room roles:
- Torvet: main social hub
- Tavern: smaller conversations
- Woods: quiet hangout
- Event room: quizzes and temporary events
- Creator/community rooms: later expansion

## Product rule
Every new feature must strengthen at least one of these:
- meeting people
- communicating
- expressing identity
- returning to the world

If a feature does not support one of those, it is not a V1 priority.
