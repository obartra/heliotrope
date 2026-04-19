import { Link } from 'react-router-dom';
import { signOut } from '../lib/auth';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-10">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-muted-foreground mb-6">Welcome to Heliotrope.</p>
      <nav className="flex gap-3 mb-6">
        <Button variant="outline" asChild>
          <Link to="/images">Image Library</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/rules">Rules</Link>
        </Button>
      </nav>
      <Button variant="ghost" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
