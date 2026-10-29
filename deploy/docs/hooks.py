"""Build hooks for the docs site (mkdocs.yml)."""
from pathlib import Path

from mkdocs.structure.files import File


def on_files(files, config):
    """Publish CHANGELOG.md, which lives at the top of the repository, as the page changelog.md."""
    changelog = Path(config["config_file_path"]).parent / "CHANGELOG.md"
    files.append(File.generated(config, "changelog.md", content=changelog.read_text(encoding="utf-8")))
    return files
