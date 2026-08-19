import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import PixelChat from "@/components/pixel/PixelChat";
import NatureTest from "@/components/pixel/NatureTest";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pixel Chat - Retro Isometric Snow Chat World" },
      {
        name: "description",
        content:
          "Walk a pixel-art snow village, chat in a retro global channel, and watch messages pop as speech bubbles above your avatar.",
      },
      { property: "og:title", content: "Pixel Chat - Retro Isometric Snow Chat World" },
      {
        property: "og:description",
        content: "A tiny isometric pixel world with click-to-move avatars and pixel-font global chat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const isNatureTest = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("nature-test");
  return isNatureTest ? <NatureTest /> : <MainIndex />;
}

function MainIndex() {
  const [username, setUsername] = useState("Player_01");
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(username);

  return (
    <main className="min-h-screen bg-background py-5">
      <header className="mx-auto mb-4 w-full max-w-[900px] px-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[15px] text-primary">
            PIXEL<span className="text-accent">CHAT</span>
          </h1>
          {editing ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setUsername(temp.trim().slice(0, 14) || "Player_01");
                setEditing(false);
              }}
            >
              <input
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
                maxLength={14}
                className="pixel-input w-[150px]"
                aria-label="Username"
              />
              <button type="submit" className="pixel-btn">
                OK
              </button>
            </form>
          ) : (
            <button className="pixel-hud" onClick={() => setEditing(true)}>
              YOU: {username} [EDIT]
            </button>
          )}
        </div>
      </header>
      <PixelChat username={username} />
      <p className="mx-auto mt-4 max-w-[900px] px-3 text-[8px] leading-[2] text-muted-foreground">
        SNOWHOLLOW SERVER &middot; V0.1 &middot; CLICK TO MOVE &middot; ENTER TO CHAT
      </p>
    </main>
  );
}
