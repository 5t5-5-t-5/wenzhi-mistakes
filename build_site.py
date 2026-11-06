"""Copy only the public app shell. Family records and server settings never enter Pages."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parent
out=root/'_site'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ['index.html','parent.html','child.html','styles.css','logic.js','data.js','ui.js','parent.js','child.js','photo.js','print.js','sync-client.js','github-direct.js','sw.js','manifest.webmanifest','icon.svg','icon-180.png','icon-child-180.png','icon-192.png','icon-512.png']:
    shutil.copy2(root/name,out/name)
shutil.copytree(root/'vendor',out/'vendor')
(out/'.nojekyll').touch()
print('Public app ready in _site/')
