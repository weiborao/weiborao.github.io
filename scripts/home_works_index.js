// Show the curated works directory above the posts on the first home page.
// The links stay in source/works/index.html, so there is only one list to edit.
const fs = require('node:fs/promises');
const path = require('node:path');

hexo.extend.filter.register('after_generate', async () => {
  const worksPath = path.join(hexo.source_dir, 'works', 'index.html');
  const homeRoute = hexo.route.get('index.html');
  if (!homeRoute) throw new Error('Hexo home page route not found');
  const [works, homeChunks] = await Promise.all([
    fs.readFile(worksPath, 'utf8'),
    (async () => {
      const chunks = [];
      for await (const chunk of homeRoute) chunks.push(Buffer.from(chunk));
      return chunks;
    })()
  ]);
  const home = Buffer.concat(homeChunks).toString('utf8');

  const groups = [...works.matchAll(/<h2 class="category-title">([\s\S]*?)<\/h2>\s*<ul class="article-grid">([\s\S]*?)<\/ul>/g)]
    .map(([, heading, list]) => ({
      heading: heading.replace(/<[^>]*>/g, '').trim(),
      links: [...list.matchAll(/<a href="(\/[^"]+\.html)">([\s\S]*?)<\/a>/g)]
        .map(([, href, label]) => ({
          href,
          label: label.replace(/<[^>]*>/g, '').replace(/→\s*$/, '').trim()
        }))
    }))
    .filter(group => group.links.length);

  if (!groups.length) throw new Error('No works links found for the home page index');

  const count = groups.reduce((total, group) => total + group.links.length, 0);
  const markup = `<!-- home-works-index:start --><section class="home-works-index" aria-labelledby="home-works-title">
    <div class="home-works-heading">
      <div><h1 id="home-works-title">技术作品索引</h1><p>按主题直达 ${count} 个独立页面</p></div>
      <a href="/works/">查看完整作品集 →</a>
    </div>
    <div class="home-works-groups">${groups.map(group => `
      <details>
        <summary>${group.heading}<span>${group.links.length} 篇</span></summary>
        <ul>${group.links.map(({ href, label }) => `<li><a href="${href}">${label}</a></li>`).join('')}</ul>
      </details>`).join('')}
    </div>
  </section><!-- home-works-index:end -->`;

  const css = `<!-- home-works-style:start --><style>
    .home-works-index{margin:0 0 2.5em;padding:1.5em;background:#fff;border:1px solid #e7ebef;border-radius:10px;box-shadow:0 4px 18px rgba(0,0,0,.035)}
    .home-works-heading{display:flex;justify-content:space-between;align-items:center;gap:1em;margin-bottom:1em}
    .home-works-heading h1{margin:0;font-size:1.45em;line-height:1.4}
    .home-works-heading p{margin:.35em 0 0;color:#666;font-size:.9em}
    .home-works-heading>a{white-space:nowrap;font-size:.9em}
    .home-works-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65em}
    .home-works-groups details{border:1px solid #edf0f3;border-radius:6px;min-width:0}
    .home-works-groups summary{display:flex;justify-content:space-between;gap:.5em;cursor:pointer;padding:.75em .9em;font-weight:600;list-style:none}
    .home-works-groups summary::-webkit-details-marker{display:none}
    .home-works-groups summary::before{content:'▸';color:#56759b;margin-right:.35em}
    .home-works-groups details[open] summary::before{content:'▾'}
    .home-works-groups summary span{margin-left:auto;white-space:nowrap;color:#888;font-size:.85em;font-weight:400}
    .home-works-groups ul{margin:0;padding:.15em 1.1em 1em 2.2em;list-style:disc}
    .home-works-groups li{margin:.35em 0;line-height:1.5}
    @media(max-width:650px){.home-works-heading{align-items:flex-start;flex-direction:column}.home-works-groups{grid-template-columns:1fr}}
  </style><!-- home-works-style:end -->`;

  const marker = /(<div class="main-inner index posts-expand">)/;
  if (!marker.test(home)) throw new Error('NexT home page insertion point not found');
  const cleanHome = home
    .replace(/<!-- home-works-style:start -->[\s\S]*?<!-- home-works-style:end -->\s*/g, '')
    .replace(/<!-- home-works-index:start -->[\s\S]*?<!-- home-works-index:end -->\s*/g, '');
  hexo.route.set('index.html', cleanHome.replace('</head>', `${css}\n</head>`).replace(marker, `$1\n${markup}`));
});
