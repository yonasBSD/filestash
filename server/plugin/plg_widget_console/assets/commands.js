import { register, all } from "./registry.js";
import { join } from "../lib/path.js";
import rxjs from "../lib/rx.js";
import ajax from "../lib/ajax.js";
import { stat, cat } from "../pages/viewerpage/model_files.js";
import { getMimeType } from "../pages/viewerpage/mimetype.js";
import { get as getConfig } from "../model/config.js";
import { ls, touch, mkdir, rm, mv } from "../pages/filespage/model_files.js";

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
    id: "clear",
    description: "Clear the terminal screen",
    run(shell) {
        shell.term.clear();
    },
});

register({
    id: "exit",
    description: "Close the shell",
    run(shell) {
        shell.classList.add("hidden");
    },
});

register({
    id: "mimetype",
    description: "Determine file type",
    run(shell, args) {
        if (!args[0]) {
            shell.term.writeln("mimetype: missing operand");
            return;
        }
        const path = join(window.location.origin + shell.cwd, args[0]);
        const sub = stat("api/files/cat?path=" + encodeURIComponent(path)).pipe(
            rxjs.catchError((err) => {
                shell.term.writeln(`mimetype: ${err.message}`);
                return rxjs.EMPTY;
            }),
        ).subscribe({
            next({ type }) {
                shell.term.writeln(
                    type === "directory"
                        ? "inode/directory"
                        : getMimeType(args[0], getConfig("mime", {})),
                );
            },
            complete() { shell.prompt(); },
        });
        return () => sub.unsubscribe();
    },
});

// register({
//     id: "xdg-open",
//     description: "Open a file",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "whoami",
//     description: "Print effective user name",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "mkdir",
//     description: "Make directories",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "rm",
//     description: "Remove files or directories",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "mv",
//     description: "Move files",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "touch",
//     description: "Create a file",
//     run(shell) {
//         // TODO
//     },
// });

// register({
//     id: "save",
//     description: "Save a file",
//     run(shell) {
//         // TODO
//     },
// });

register({
    id: "pwd",
    description: "Print current/working directory",
    run(shell) {
        shell.term.writeln(shell.cwd);
    },
});

register({
    id: "cd",
    description: "Change working directory",
    run(shell, args) {
        if (!args[0]) {
            shell.cwd = shell.home || "/";
            return;
        }
        const path = join(window.location.origin + shell.cwd, args[0])
              .replace(new RegExp("\/?$"), "/");
        const sub = stat("api/files/cat?path=" + encodeURIComponent(path)).subscribe({
            next({ type }) {
                if (type !== "directory") shell.term.writeln("cd: not a directory");
                else shell.cwd = path;
            },
            error(err) { shell.term.writeln(`cd: ${err.message}`); },
            complete() { shell.prompt(); },
        });
        return () => sub.unsubscribe();
    },
});

register({
    id: "ls",
    description: "List directory contents",
    run(shell, args) {
        const path = args[0] ?
              join(window.location.origin + shell.cwd, args[0]).replace(new RegExp("\/?$"), "/")
              : shell.cwd;

        const sub = ls(path).pipe(
            rxjs.debounceTime(100),
            rxjs.first(),
            rxjs.catchError((err) => {
                shell.term.writeln(`ls: ${err.message}`);
                return rxjs.EMPTY;
            }),
        ).subscribe({
            next({ files }) {
                const output = files.map((entry) =>
                    entry.type === "directory"
                        ? `\x1b[1;34m${entry.name}\x1b[0m`
                        : entry.name
                ).join("  ");
                shell.term.writeln(output);
            },
            complete() { shell.prompt(); },
        });
        return () => sub.unsubscribe();
    },
});

register({
    id: "stat",
    description: "Display file info",
    run(shell, args) {
        if (!args[0]) {
            shell.term.writeln("stat: missing operand");
            return;
        }
        const path = join(window.location.origin + shell.cwd, args[0]);
        const sub = stat("api/files/cat?path=" + encodeURIComponent(path)).subscribe({
            next({ type, size, time }) {
                shell.term.writeln(`  File: ${args[0]}`);
                shell.term.writeln(`  Type: ${type}`);
                shell.term.writeln(`  Size: ${size}`);
                shell.term.writeln(`Modify: ${new Date(time).toLocaleString()}`);
            },
            error(err) { shell.term.writeln(`stat: ${err.message}`); },
            complete() { shell.prompt(); },
        });
        return () => sub.unsubscribe();
    },
});

register({
    id: "cat",
    description: "Display file contents",
    run(shell, args) {
        if (!args[0]) {
            shell.term.writeln("cat: missing operand");
            return;
        }
        const path = join(window.location.origin + shell.cwd, args[0]);
        const sub = cat("api/files/cat?path=" + encodeURIComponent(path)).pipe(
            rxjs.catchError((err) => {
                shell.term.writeln(`cat: ${err.message}`);
                return rxjs.EMPTY;
            }),
        ).subscribe({
            next(response) {
                const text = typeof response === "string"
                    ? response
                    : new TextDecoder().decode(response);
                text.split("\n").forEach((line) => shell.term.writeln(line));
            },
            complete() { shell.prompt(); },
        });
        return () => sub.unsubscribe();
    },
});
