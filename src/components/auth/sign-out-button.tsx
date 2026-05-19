import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

/** Server-rendered sign-out control — posts to the signOut Server Action. */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="font-display font-semibold"
      >
        Sign out
      </Button>
    </form>
  );
}
