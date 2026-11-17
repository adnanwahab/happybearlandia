#!/usr/bin/env python3
"""Bounded data-only GitHub/npm transport. Never execute selected source on host."""
import base64, hashlib, io, json, os, pathlib, platform, re, sys, tarfile, tempfile, urllib.request
MAX_DOWNLOAD = 192 * 1024 * 1024
MAX_EXPANDED = 768 * 1024 * 1024
MAX_FILES = 50000
NAME = re.compile(r'(?:@[a-z0-9._-]+/)?[a-z0-9._-]+')
VERSION = re.compile(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.+-]+)?(?:\+[a-zA-Z0-9.+-]+)?')
class Invalid(Exception): pass

def download(url, limit=MAX_DOWNLOAD):
    # Only fixed transports. No token, credential, environment proxy or redirect.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args): raise Invalid('Source transport redirect rejected')
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(urllib.request.Request(url, headers={'User-Agent':'hbl-preview-runner/1'}), timeout=45) as response:
        if int(response.headers.get('content-length','0')) > limit: raise Invalid('Download too large')
        result = response.read(limit + 1)
    if len(result)>limit: raise Invalid('Download too large')
    return result

def safe_members(raw, strip=True):
    result=[]; total=0
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as archive:
        for entry in archive:
            parts=pathlib.PurePosixPath(entry.name).parts
            if entry.name.startswith('/') or '..' in parts or '\\' in entry.name or any(ord(c)<32 for c in entry.name): raise Invalid('Unsafe archive path')
            if strip: parts=parts[1:]
            if not parts: continue
            name='/'.join(parts)
            if any(p in {'.git','node_modules','.ssh','.aws','.agents','.codex','.netrc','.npmrc','.bunfig.toml','bunfig.toml'} for p in parts): continue
            if any(p.startswith('.env') and p!='.env.example' for p in parts): continue
            if parts[-1] in {'.git-credentials','id_rsa','id_ed25519'} or re.search(r'\.(?:sqlite3?|db)(?:-wal|-shm)?$',parts[-1],re.I): continue
            if entry.isdir(): continue
            if not entry.isfile() or entry.size>128*1024*1024: raise Invalid('Archive links/special/oversized files forbidden')
            total+=entry.size
            if total>MAX_EXPANDED or len(result)>=MAX_FILES: raise Invalid('Archive expansion bound exceeded')
            result.append((name, archive.extractfile(entry).read(), entry.mode & 0o111))
    if len({r[0] for r in result})!=len(result): raise Invalid('Duplicate archive paths')
    return result

def jsonc(value):
    # Bun lock is JSON with trailing commas; do not evaluate JavaScript.
    out=[]; quoted=False; escaped=False; i=0
    while i<len(value):
        c=value[i]
        if quoted:
            out.append(c)
            if escaped: escaped=False
            elif c=='\\': escaped=True
            elif c=='"': quoted=False
        elif c=='"': quoted=True;out.append(c)
        elif c==',':
            j=i+1
            while j<len(value) and value[j].isspace(): j+=1
            if j==len(value) or value[j] not in ']}': out.append(c)
        else: out.append(c)
        i+=1
    return json.loads(''.join(out))

def prepare(sha, target):
    if not re.fullmatch('[0-9a-f]{40}',sha): raise Invalid('Exact full SHA required')
    source=safe_members(download('https://codeload.github.com/adnanwahab/happybearlandia/tar.gz/'+sha))
    if any(name=='.preview-revision.json' for name,_,_ in source): raise Invalid('Reserved preview revision marker in source')
    files={name:value for name,value,_ in source}
    if 'server.js' not in files or 'bun.lock' not in files: raise Invalid('Revision lacks supported Bun launch recipe')
    lock=jsonc(files['bun.lock'].decode())
    packages=lock.get('packages')
    if lock.get('lockfileVersion') not in [1,2] or not isinstance(packages,dict) or len(packages)>600: raise Invalid('Unsupported dependency lock')
    # Support flat package placement only. Unsupported workspaces/git/native scripts
    # fail explicitly instead of running a package manager or lifecycle hook on host.
    payload=list(source); expanded=sum(len(v) for _,v,_ in payload); downloaded=0
    architecture='arm64' if platform.machine() in ['arm64','aarch64'] else 'x64'
    for key, spec in packages.items():
        if not NAME.fullmatch(key) or not isinstance(spec,list) or len(spec)<4 or spec[1]!='': raise Invalid('Only flat locked npm-registry packages supported')
        metadata=spec[2]
        if not isinstance(metadata,dict): raise Invalid('Unsupported dependency metadata')
        if metadata.get('os') not in [None,'linux'] or metadata.get('cpu') not in [None,architecture]: continue
        # The trusted image uses glibc; optional musl binaries are not installed.
        if key.startswith('@oven/bun-linux-') and key.endswith('-musl'): continue
        identity=spec[0]; name,version=identity.rsplit('@',1)
        if name!=key or not NAME.fullmatch(name) or not VERSION.fullmatch(version): raise Invalid('Unsafe dependency identity')
        integrity=spec[3]
        if not isinstance(integrity,str) or not integrity.startswith('sha512-'): raise Invalid('Locked sha512 integrity required')
        raw=download('https://registry.npmjs.org/'+name+'/-/'+name.split('/')[-1]+'-'+version+'.tgz',64*1024*1024)
        downloaded+=len(raw)
        if downloaded>256*1024*1024: raise Invalid('Cumulative dependency download budget exceeded')
        if base64.b64encode(hashlib.sha512(raw).digest()).decode()!=integrity[7:]: raise Invalid('Dependency integrity mismatch')
        for rel,value,executable in safe_members(raw):
            expanded+=len(value)
            if expanded>MAX_EXPANDED or len(payload)>MAX_FILES: raise Invalid('Dependency expansion bound exceeded')
            payload.append(('node_modules/'+key+'/'+rel,value,executable))
    payload.append(('.preview-revision.json',json.dumps({'repository':'adnanwahab/happybearlandia','sha':sha,'recipe':'bun-network-none.v1','lifecycleScripts':False}).encode(),0))
    with tarfile.open(target,'w') as archive:
        for name,value,executable in payload:
            info=tarfile.TarInfo(name);info.size=len(value);info.mode=0o755 if executable else 0o644;info.uid=1000;info.gid=1000
            archive.addfile(info,io.BytesIO(value))
    os.chmod(target,0o600)
    return {'sha':sha,'files':len(payload),'expandedBytes':expanded}
if __name__=='__main__':
    try: print(json.dumps(prepare(sys.argv[1],sys.argv[2])))
    except Exception as error:
        print(str(error) if isinstance(error,Invalid) else 'Source/dependency transport unavailable; no host source executed',file=sys.stderr);sys.exit(1)
