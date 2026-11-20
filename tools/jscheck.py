"""Static sanity check for the Chrono Lab ES modules.

No JS runtime is installed here, so this verifies three things that a syntax
error or a refactor slip would break:

  1. brackets/quotes balance in every module,
  2. every relative import points at a file that exists,
  3. every named import is actually exported by its target module.

It is a lint, not a parser: run the page in a browser for the real check.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

OPEN = "([{"
CLOSE = ")]}"
PAIR = {")": "(", "]": "[", "}": "{"}


def balance(text: str) -> str | None:
    stack: list[tuple[str, int]] = []
    line = 1
    i = 0
    n = len(text)
    quote: str | None = None
    while i < n:
        ch = text[i]
        if quote is None:
            if ch == "\n":
                line += 1
                i += 1
                continue
            if ch == "/" and i + 1 < n and text[i + 1] == "/":
                while i < n and text[i] != "\n":
                    i += 1
                continue
            if ch == "/" and i + 1 < n and text[i + 1] == "*":
                i += 2
                while i + 1 < n and not (text[i] == "*" and text[i + 1] == "/"):
                    if text[i] == "\n":
                        line += 1
                    i += 1
                i += 2
                continue
            if ch in "'\"`":
                quote = ch
                i += 1
                continue
            if ch in OPEN:
                stack.append((ch, line))
                i += 1
                continue
            if ch in CLOSE:
                if not stack:
                    return f"line {line}: unexpected '{ch}'"
                opener, opened = stack.pop()
                if opener != PAIR[ch]:
                    return f"line {line}: '{ch}' closes '{opener}' opened on line {opened}"
                i += 1
                continue
            i += 1
        else:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = None
                i += 1
                continue
            if ch == "\n":
                line += 1
            i += 1
    if stack:
        opener, opened = stack[-1]
        return f"unclosed '{opener}' opened on line {opened}"
    if quote:
        return f"unterminated {quote} string"
    return None


EXPORT_PATTERNS = (
    r"export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)",
    r"export\s+const\s+([A-Za-z_$][\w$]*)",
    r"export\s+let\s+([A-Za-z_$][\w$]*)",
    r"export\s+class\s+([A-Za-z_$][\w$]*)",
)


def exports_of(text: str) -> set[str]:
    names: set[str] = set()
    for pattern in EXPORT_PATTERNS:
        names.update(re.findall(pattern, text))
    for block in re.findall(r"export\s*\{([^}]*)\}", text):
        for part in block.split(","):
            part = part.strip()
            if not part:
                continue
            names.add(part.split(" as ")[-1].strip())
    return names


IMPORT_RE = re.compile(r"import\s*\{([^}]*)\}\s*from\s*['\"]([^'\"]+)['\"]")


def main() -> int:
    modules = sorted(
        p for p in (ROOT / "src").glob("*.js") if p.name != "three.module.js"
    )
    failures: list[str] = []
    checked = 0

    for module in modules:
        text = module.read_text(encoding="utf-8")
        problem = balance(text)
        if problem:
            failures.append(f"{module.name}: {problem}")
            continue
        checked += 1

        for names_blob, spec in IMPORT_RE.findall(text):
            if not spec.startswith("."):
                continue
            target = (module.parent / spec).resolve()
            if not target.exists():
                failures.append(f"{module.name}: missing import target {spec}")
                continue
            if target.name.startswith("three."):
                continue
            available = exports_of(target.read_text(encoding="utf-8"))
            for raw in names_blob.split(","):
                raw = raw.strip()
                if not raw:
                    continue
                wanted = raw.split(" as ")[0].strip()
                if wanted and wanted not in available:
                    failures.append(
                        f"{module.name}: imports '{wanted}' from {target.name}, "
                        f"which does not export it"
                    )

    print(f"modules checked: {checked}/{len(modules)}")
    if failures:
        print("FAILURES:")
        for item in failures:
            print("  -", item)
        return 1
    print("OK: brackets balanced, imports resolve, imported names are exported")
    return 0


if __name__ == "__main__":
    sys.exit(main())
