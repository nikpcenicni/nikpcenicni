#!/usr/bin/env python3
"""Generate profile stat cards from the REST API.

GitHub's contribution graph reports nothing for this account, so the usual
stat services show zeros. This counts commits, stars and languages repo by
repo instead and writes two SVGs to assets/.

Needs GH_TOKEN with read access to every repo that should be counted.
"""
import datetime as dt
import html
import json
import os
import re
import urllib.request
from collections import Counter

USER = os.environ.get("GH_USER", "nikpcenicni")
TOKEN = os.environ["GH_TOKEN"]
OUT = os.path.join(os.path.dirname(__file__), "..", "assets")

# Markup and engine-generated files skew the language bar.
IGNORED_LANGS = {"HTML", "CSS", "SCSS", "Jupyter Notebook", "Dockerfile", "Makefile",
                 "Smarty", "ShaderLab", "HLSL", "ASP.NET"}


def get(url):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": f"{USER}-profile-stats",
    })
    with urllib.request.urlopen(req) as r:
        body = r.read()
        return (json.loads(body) if body else None), r.headers.get("Link", "")


def paged(url):
    while url:
        data, link = get(url)
        yield from data
        m = re.search(r'<([^>]+)>;\s*rel="next"', link)
        url = m.group(1) if m else None


def count_commits(repo, since=None):
    url = f"https://api.github.com/repos/{repo}/commits?author={USER}&per_page=1"
    if since:
        url += f"&since={since}"
    try:
        data, link = get(url)
    except urllib.error.HTTPError as e:
        if e.code == 409:  # empty repo
            return 0
        raise
    m = re.search(r'[?&]page=(\d+)>;\s*rel="last"', link)
    return int(m.group(1)) if m else len(data or [])


def main():
    year_ago = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=365)).strftime("%Y-%m-%dT%H:%M:%SZ")
    repos = [r for r in paged("https://api.github.com/user/repos?affiliation=owner&per_page=100")
             if r["owner"]["login"] == USER and not r["fork"]]

    stars = sum(r["stargazers_count"] for r in repos)
    commits = commits_year = active = 0
    langs = Counter()
    for r in repos:
        name = r["full_name"]
        n = count_commits(name)
        commits += n
        y = count_commits(name, year_ago)
        commits_year += y
        active += y > 0
        if n:
            # Weight each repo's language mix by commits, so one big Unity
            # project doesn't drown out everything else.
            sizes = {k: v for k, v in (get(f"https://api.github.com/repos/{name}/languages")[0] or {}).items()
                     if k not in IGNORED_LANGS}
            total = sum(sizes.values())
            for lang, size in sizes.items():
                langs[lang] += n * size / total

    os.makedirs(OUT, exist_ok=True)
    write_stats({
        "Total commits": commits,
        "Commits (last 12 months)": commits_year,
        "Repos active (last 12 months)": active,
        "Repositories": len(repos),
        "Stars earned": stars,
    })
    write_langs(langs.most_common(8))


# Tokyo Night, to match the rest of the README.
BG, TITLE, TEXT, ICON = "#1a1b27", "#70a5fd", "#a9b1d6", "#bf91f3"
COLORS = {
    "TypeScript": "#3178c6", "JavaScript": "#f1e05a", "Python": "#3572A5", "Shell": "#89e051",
    "HCL": "#844FBA", "C": "#555555", "C++": "#f34b7d", "Java": "#b07219", "C#": "#178600",
    "Go": "#00ADD8", "Rust": "#dea584", "PHP": "#4F5D95", "Jinja": "#a52a22", "Smarty": "#f0c040",
}
FONT = "font-family='Segoe UI,Ubuntu,Helvetica,sans-serif'"


def card(title, h, body):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='420' height='{h}' viewBox='0 0 420 {h}'>"
            f"<rect width='420' height='{h}' rx='6' fill='{BG}'/>"
            f"<text x='25' y='35' {FONT} font-size='18' font-weight='600' fill='{TITLE}'>{title}</text>"
            f"{body}</svg>\n")


def write_stats(rows):
    body = ""
    for i, (label, value) in enumerate(rows.items()):
        y = 70 + i * 26
        body += (f"<circle cx='31' cy='{y - 5}' r='4' fill='{ICON}'/>"
                 f"<text x='45' y='{y}' {FONT} font-size='14' fill='{TEXT}'>{label}:</text>"
                 f"<text x='395' y='{y}' {FONT} font-size='14' font-weight='700' fill='{TEXT}' "
                 f"text-anchor='end'>{value:,}</text>")
    with open(os.path.join(OUT, "stats.svg"), "w") as f:
        f.write(card("🧪 Nik's GitHub Stats", 70 + len(rows) * 26, body))


def write_langs(top):
    total = sum(s for _, s in top) or 1
    body, x = "<clipPath id='bar'><rect x='25' y='52' width='370' height='8' rx='4'/></clipPath><g clip-path='url(#bar)'>", 25.0
    for lang, size in top:
        w = 370 * size / total
        body += f"<rect x='{x:.2f}' y='52' width='{w:.2f}' height='8' fill='{COLORS.get(lang, '#8b949e')}'/>"
        x += w
    body += "</g>"
    for i, (lang, size) in enumerate(top):
        cx, cy = 25 + (i % 2) * 190, 88 + (i // 2) * 24
        body += (f"<circle cx='{cx + 5}' cy='{cy - 4}' r='5' fill='{COLORS.get(lang, '#8b949e')}'/>"
                 f"<text x='{cx + 16}' y='{cy}' {FONT} font-size='13' fill='{TEXT}'>"
                 f"{html.escape(lang)} {100 * size / total:.1f}%</text>")
    with open(os.path.join(OUT, "langs.svg"), "w") as f:
        f.write(card("🛠️ Most Used Languages", 88 + ((len(top) + 1) // 2) * 24, body))


if __name__ == "__main__":
    main()
