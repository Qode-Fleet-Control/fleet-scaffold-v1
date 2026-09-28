import { Link, Route, Switch } from "wouter";
import NotesPage from "./pages/NotesPage";

export default function App() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 flex items-baseline justify-between">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Scaffold
        </Link>
        <span className="text-sm text-gray-500">React · Vite · Tailwind</span>
      </header>
      <Switch>
        <Route path="/" component={NotesPage} />
        <Route>
          <p className="text-gray-500">Not found.</p>
        </Route>
      </Switch>
    </div>
  );
}
