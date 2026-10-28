import re, os, io
ROOT = '/home/claude/proj/WhatsApp-Channel-Manager'
def rd(p): return io.open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s): io.open(os.path.join(ROOT, p), 'w', encoding='utf-8').write(s)

NAV = [
 ('home.html','⌂','Home'), ('stories.html','▤','Stories'), ('video.html','🎞','Video Import'),
 ('episodes.html','▥','Episodes'), ('ready-made.html','✍','Ready-Made Episodes'),
 ('workflow.html','🧭','Workflow'), ('schedule.html','🗓','Schedule'), ('planner.html','◷','Planner'),
 ('hype.html','↗','Hype'), ('media.html','▣','Media Library'), ('docs.html','📄','Document Reader'),
 ('channels.html','◎','Channels'), ('complaints.html','⚑','Complaints'), ('reviews.html','★','Reviews'),
 ('notifications.html','♧','Alerts'), ('backup.html','▣','Backup'), ('settings.html','⚙','Settings'),
]
def nav_html(active):
    return '<nav class="main-nav" aria-label="Main navigation">' + '\n'.join(
        '<a class="nav-link%s" href="%s"><span>%s</span><b>%s</b></a>' % (' active' if h == active else '', h, i, l) for h, i, l in NAV) + '</nav>'

HEAD_EXTRA = '<link rel="stylesheet" href="css/glass3d.css">\n<link rel="stylesheet" href="css/studio-features.css">\n'
COMMON_SCRIPTS = '<script src="js/studio-core.js"></script><script src="js/studio-alerts.js"></script><script src="js/glass3d.js"></script><script src="js/tutorial.js"></script>'
EXTRA_PAGE_SCRIPTS = {
  'workflow.html': 'js/workflow.js', 'schedule.html': 'js/schedule.js', 'planner.html': 'js/schedule.js',
  'video.html': 'js/video-import.js', 'notifications.html': 'js/notification-center.js', 'channels.html': 'js/channel-insights.js',
}
TUTORIAL_LINK = '<a class="nav-link" href="#tour" data-start-tour><span>🎓</span><b>Tutorial</b></a>\n'

def shell(page, title, eyebrow, topbar_title, desc, main):
    return f'''<!doctype html>
<html lang="en" data-theme="system">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <script src="js/app-shell-behavior.js"></script><meta name="theme-color" content="#101827"><meta name="description" content="{desc}"><title>{title} — Channel Studio</title><link rel="manifest" href="manifest.webmanifest"><link rel="stylesheet" href="css/styles.css"><link rel="stylesheet" href="css/animations.css">
<link rel="stylesheet" href="css/themes.css">
</head>
<body data-page="{page[:-5]}">
<div class="app-layout">
<aside class="sidebar"><a class="brand" href="home.html"><span class="brand-mark small-mark">CS</span><span>Channel<span class="brand-accent">Studio</span><small>YOUR CREATOR SPACE</small></span></a>{nav_html(page)}<div class="sidebar-bottom"><a class="nav-link" href="#tour" data-start-tour><span>🎓</span><b>Tutorial</b></a>
<a class="nav-link" href="index.html"><span>↗</span><b>Welcome screen</b></a><p class="small muted">Keep creating. Keep your stories safe.</p></div></aside>
<div class="main-column"><header class="topbar"><button id="menuToggle" class="icon-button mobile-menu" aria-label="Open menu">☰</button><div><p class="eyebrow">{eyebrow}</p><p class="topbar-title">{topbar_title}</p></div><div class="topbar-actions"><button id="quickTheme" class="icon-button" aria-label="Toggle theme" title="Toggle theme">◐</button><a class="avatar-link" href="settings.html" aria-label="Settings">CS</a></div></header>
<main class="page-content page-enter">
{main}
</main><footer class="app-footer">Made for your stories <span>✦</span> <span class="muted">Local-first • Your content stays yours</span></footer></div></div>
<div id="toastRegion" class="toast-region" aria-live="polite" aria-atomic="true"></div>
<script src="js/storage.js"></script><script src="js/themes.js"></script><script src="js/transitions.js"></script><script src="js/effects.js"></script><script src="js/notifications.js"></script><script src="js/app.js"></script>
</body></html>
'''

WORKFLOW_MAIN = '''<section class="page-intro"><p class="eyebrow">EPISODE WORKFLOW</p><h1>Episode <span>workflow</span></h1><p class="muted">Move each episode through <b>Edit → Ready to Post → Scheduled → Posted</b>. Folders are organised by story, then season, with completed and remaining counts.</p></section>
<div class="wf-tabs" id="wfTabs" role="tablist" aria-label="Episode stage"></div>
<div class="wf-toolbar"><input id="wfSearch" type="search" placeholder="Search episodes…" aria-label="Search episodes"><select id="wfStory" aria-label="Filter by story"></select></div>
<div id="wfTree"></div>
<dialog id="wfEditor" class="glass-dialog"><div class="dlg-body"><h3 id="edHead">Edit episode</h3><p class="small muted" id="edMeta"></p>
<label class="dlg-field">Title<input id="edTitle" maxlength="200"></label>
<label class="dlg-field">Episode text<textarea id="edText"></textarea></label><p class="small muted" id="edCount"></p>
<div class="row-wrap"><button class="button primary" type="button" id="edSave">Save</button><button class="button primary" type="button" id="edSaveReady">Save &amp; mark ready ✅</button><button class="button ghost" type="button" data-close-dialog>Close</button></div></div></dialog>
<dialog id="wfSchedule" class="glass-dialog"><div class="dlg-body"><h3 id="scHead">Schedule episode</h3><p class="small muted" id="scInfo"></p>
<label class="dlg-field">Post to channel<select id="scCh"></select></label>
<label class="dlg-field">Date &amp; time<input id="scWhen" type="datetime-local"></label><p class="small muted" id="scDay"></p>
<div id="scBulk" hidden><label class="dlg-field">Then post the next episode…<select id="scEvery"><option value="24">every day</option><option value="48">every 2 days</option><option value="12">every 12 hours</option><option value="6">every 6 hours</option></select></label><p class="small muted">Maximum 4 posts per day. Scheduling stops and tells you if a day is full.</p></div>
<label class="dlg-field">Alert me before<select id="scLead"><option value="0">At posting time</option><option value="5">5 minutes before</option><option value="15">15 minutes before</option><option value="30">30 minutes before</option><option value="60">1 hour before</option></select></label>
<div class="row-wrap"><button class="button primary" type="button" id="scConfirm">Schedule</button><button class="button ghost" type="button" data-close-dialog>Cancel</button></div>
<p class="small muted">Channel Studio alerts you and prepares the post. You publish it in WhatsApp, then confirm.</p></div></dialog>'''

SCHEDULE_MAIN = '''<section class="page-intro"><p class="eyebrow">POSTING SCHEDULE</p><h1>Your <span>schedule</span></h1><p class="muted">Every planned post in one clean agenda, with clear status badges. When a post is due, copy it and open your channel in one tap.</p></section>
<section class="panel"><div id="scheduleView"></div></section>'''

VIDEO_MAIN = '''<section class="page-intro"><p class="eyebrow">FORWARDED VIDEOS</p><h1>Video <span>import</span></h1><p class="muted">Turn a video’s spoken story into text, review it, then split it into episodes and seasons.</p></section>
<div class="vi-notice"><span aria-hidden="true">💡</span><p><b>Why a transcript first?</b> A video file is pictures and sound — there’s no text to cut into episodes. Channel Studio gets the words first, you check them, and only then does the splitter divide the text into episodes (250–300 words each) and seasons (up to 13 episodes each).</p></div>
<div class="vi-steps">
<section class="vi-step panel"><h2><span class="vi-num">1</span>Choose the video</h2><p class="muted small">Pick a file, or share a video to Channel Studio from WhatsApp or your gallery (installed app on Android: Share → Channel Studio).</p>