# AI Agent Skill: Git Operations in Git Bash (Windows)

**Description:** This skill module equips the AI agent with comprehensive knowledge of Git operations specifically tailored for Windows environments using Git Bash. It emphasizes non-interactive execution, proper escaping, and Windows-specific environment variable configurations.

## 1. CLI Execution & Interactive Escaping in Git Bash
When executing commands in Git Bash, Git may trigger interactive prompts or terminal pagers. The AI must strictly follow these rules to prevent freezing automated processes:

*   **Escaping Pagers (The "q" Rule):** If standard output is a terminal, Git will often pipe output into `less` (or your configured `$PAGER`). If an interactive paging mode is triggered (e.g., by `git log` or `git diff`), **you must output the `q` keystroke to escape the pager** and return to the prompt.
*   **Preventing Pagers Entirely:** To avoid interactive paging, use the `-P` or `--no-pager` global option before the git command (e.g., `git --no-pager log`). You can also set the `GIT_PAGER` environment variable to `cat` or an empty string to prevent Git from launching a pager.
*   **Disabling Terminal Prompts:** Set `GIT_TERMINAL_PROMPT=false` to ensure Git does not pause to prompt on the terminal (such as when asking for HTTP authentication).
*   **Disabling Advice Hints:** Use the `--no-advice` flag or set the `GIT_ADVICE=0` environment variable. This disables hint messages intended for humans that might disrupt your automated parsing.

## 2. Windows-Specific Environment Variables & Handling
When running on Windows, the AI must account for specific path structures and process behaviors:

*   **Home Directory Resolution:** On Windows, if the `HOME` environment variable is unset, Git will set a process environment variable equal to `$HOMEDRIVE$HOMEPATH` (if both exist); otherwise, it will fall back to `$USERPROFILE`.
*   **Path List Separators:** When configuring a list of object directories via the `GIT_ALTERNATE_OBJECT_DIRECTORIES` environment variable, **you must use a semicolon (`;`) to separate paths** on Windows, whereas Linux/macOS uses a colon (`:`). 
*   **Handle Redirection (Windows-Only):** In multi-threaded Windows applications, passing standard handles via `CreateProcess()` requires marking them inheritable, which can block regular Git operations. To avoid this, use the Windows-only environment variables `GIT_REDIRECT_STDIN`, `GIT_REDIRECT_STDOUT`, and `GIT_REDIRECT_STDERR`.
    *   This is especially useful when using named pipes for communication (e.g., specifying a path like `\.\pipe\my-git-stdin-123`).
    *   You can set these variables to the special value `off` to simply close the corresponding standard handle.
    *   Setting `GIT_REDIRECT_STDERR` to `2>&1` will redirect standard error to the same handle as standard output.

## 3. Essential Core Commands (Porcelain)
Use these high-level commands for standard repository management within Git Bash:

*   **Project Setup:** 
    *   `git init`: Create an empty repository or reinitialize an existing one.
    *   `git clone`: Clone a repository into a new directory.
*   **Snapshotting:** 
    *   `git add`: Add file contents to the index.
    *   `git status`: Show the working tree status.
    *   `git commit`: Record changes to the repository.
*   **Branching & Updating:** 
    *   `git switch`: Switch branches.
    *   `git pull`: Fetch from and integrate with another repository or local branch.
    *   `git push`: Update remote refs along with associated objects.

## 4. Advanced Scripting (Plumbing Commands)
When interacting with Git programmatically, utilize low-level "plumbing" commands, as their interfaces and output formatting are significantly more stable for scripting than standard user commands:

*   `git apply`: Apply a patch to files and/or the index.
*   `git hash-object`: Compute object ID and optionally create an object from a file.
*   `git update-index`: Register file contents in the working tree to the index.
*   `git diff-index` / `git diff-files`: Compare trees, working trees, and indexes stably.

## 5. Symbolic Identifiers
When specifying commits, utilize standard Git symbolic notation recognized across all environments:
*   `HEAD`: Indicates the head of the current branch.
*   **Tags:** Use a valid tag name (e.g., `refs/tags/<name>`).
*   **Heads:** Use a valid head name (e.g., `refs/heads/<name>`).