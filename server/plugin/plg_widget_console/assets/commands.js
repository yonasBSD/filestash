import { register, all } from "./registry.js";

register({
    id: "help",
    description: "Show available commands",
    run(shell) {
        const commands = all();
        shell.term.writeln("Available commands:");
        const width = Math.max(...commands.map((c) => c.id.length));
        for (const cmd of commands) {
            shell.term.writeln(`  ${cmd.id.padEnd(width + 2)}${cmd.description}`);
        }
    },
});

register({
    id: "about",
    description: "Show information about your instance",
    run(shell) {
        const controller = new AbortController();
        fetch("/about", { signal: controller.signal })
            .then((res) => res.text())
            .then((html) => {
                const $doc = new DOMParser().parseFromString(html, "text/html");
                $doc.querySelectorAll("style, script").forEach((el) => el.remove());
                $doc.body.textContent
                    .split("\n")
                    .map((line) => line.trim())
                    .filter((line) => line !== "")
                    .forEach((line) => shell.term.writeln(line));
            })
            .catch((err) => {
                if (err.name === "AbortError") return;
                shell.term.writeln(`about: ${err.message}`);
            })
            .finally(() => shell.prompt());
        return () => controller.abort();
    },
});

register({
    id: "exit",
    description: "Close the shell",
    run(shell) {
        shell.classList.add("hidden");
    },
});
