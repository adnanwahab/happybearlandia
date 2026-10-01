import { createRoot } from "react-dom/client";



import {useEffect} from "react"

const scenes = ["scene", "scene_2", "scene_3"];

const links = [
  ...scenes.map((id, i) => [`Play Scene ${i + 1}`, `/game/${id}`]),
  ...scenes.map((id, i) => [`Edit Scene ${i + 1}`, `/edit/${id}`]),
  ["Debug Sessions", "/tools/debug-events.html"],
  ["scene_3.json", "/api/scenes/scene_3"],
];



function App() {
  useEffect(() => {
    console.log('client side logic')
  }, [])
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-8 bg-blue-900 text-blue-200 min-h-screen">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">HappyBearLandia</h1>
        <p className="max-w-3xl text-sm text-blue-200">
          Multiplayer physics playground for designing, testing, and editing interactive scenes.
        </p>
      </header>
      <section>
        <iframe width="100%" height="500" src="./game/casino"></iframe>
      </section>

      <section className="rounded-xl border border-slate-200 bg-blue-900 p-4 shadow-sm space-y-3 text-blue-200">
        <h2 className="text-lg font-semibold">Quick links</h2>

        <nav className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4 lg:grid-cols-8">
          {links.map(([label, href]) => (
            <a
              key={href}
              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700 transition hover:bg-blue-100"
              href={href}
            >
              {label}
            </a>
          ))}
        </nav>
      </section>

      <section className="space-y-4">
        <article className="rounded-xl border border-slate-200 bg-blue-900 p-4 shadow-sm text-blue-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="md:w-1/2 space-y-2">
              <h2 className="text-xl font-semibold">Games</h2>
              <p className="text-justify text-blue-200">
                A document-based simulator that generates structured gameplay data to improve neural network effectiveness and scenario coverage.
              </p>
            </div>

            <div className="w-full md:w-[500px] md:flex-shrink-0">
              <img
                src="./data/games.gif"
                alt="Games simulator preview"
                className="h-auto w-full rounded-lg border border-slate-200 object-cover"
              />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-blue-900 p-4 shadow-sm text-blue-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="md:w-1/2 space-y-2">
              <h2 className="text-xl font-semibold">Multiplayer Robots</h2>
              <p className="text-justify text-blue-200">
                Multiple players can enter the same scene, control robot avatars in real time, and coordinate puzzle actions together. This helps you validate scene logic, timing, and interaction rules under real multiplayer conditions.
              </p>
            </div>

            <div className="w-full md:w-[500px] md:flex-shrink-0">
              <img
                src="./data/multiplayer-robots.png"
                alt="Multiplayer robots preview"
                className="h-auto w-full rounded-lg border border-slate-200 object-cover"
              />
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-blue-900 p-4 shadow-sm text-blue-200">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="md:w-1/2 space-y-2">
              <h2 className="text-xl font-semibold">Augmented Reality</h2>
              <p className="text-justify text-blue-200">
                Design scenes for AR by placing objects, testing spatial relationships, and previewing interactive behavior before deployment. This workflow makes it easier to iterate on scale, layout, and player guidance in mixed-reality experiences.
              </p>
            </div>

            <div className="w-full md:w-[500px] md:flex-shrink-0">
              <div className="w-full aspect-square overflow-hidden rounded-lg border border-slate-200">
                <img
                  src="./data/augmented_reality.gif"
                  alt="Augmented reality preview"
                  className="h-full w-full object-cover object-center"
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <section>

        <iframe width="100%" height="500" src="./tools"></iframe>

      </section>

      <footer>
        <a
          href="https://github.com/adnanwahab/happybearlandia"
          className="text-sm font-medium text-blue-200 underline hover:text-blue-100"
        >
          Github Repo
        </a>
      </footer>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
