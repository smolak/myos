export interface Command {
  id: string;
  label: string;
  description?: string;
  group?: string;
  keywords?: string[];
  action: () => void;
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(command: Command): () => void {
    this.commands.set(command.id, command);
    return () => this.commands.delete(command.id);
  }

  registerMany(commands: Command[]): () => void {
    const unregisters = commands.map((c) => this.register(c));
    return () => {
      for (const u of unregisters) u();
    };
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  search(query: string): Command[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAll();
    return this.getAll().filter((cmd) => {
      const text = [cmd.label, cmd.description ?? "", cmd.group ?? "", ...(cmd.keywords ?? [])].join(" ").toLowerCase();
      return text.includes(q);
    });
  }
}

export const commandRegistry = new CommandRegistry();
