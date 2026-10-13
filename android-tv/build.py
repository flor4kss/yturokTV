"""Build a signed, universal Android TV APK with local Android build tools.

Tools are kept in .tools/android; signing material never enters Git.
"""
import json, os, secrets, subprocess, zipfile
from pathlib import Path

root=Path(__file__).resolve().parent.parent
paths=json.loads((root/'.tools/android/paths.json').read_text('utf-8-sig'))
jdk=Path(paths['jdk']); tools=next(Path(paths['build-tools;35.0.0']).rglob('aapt2.exe')).parent
android_jar=next(Path(paths['platforms;android-35']).rglob('android.jar'))
build=root/'.tools/android/apk-build';build.mkdir(parents=True,exist_ok=True)
classes=build/'classes';classes.mkdir(exist_ok=True)
dex=build/'dex';dex.mkdir(exist_ok=True)
out=root/'downloads';out.mkdir(exist_ok=True)
def run(*args):
 subprocess.run([str(x) for x in args],check=True,cwd=root)

run(tools/'aapt2.exe','compile','--dir',root/'android-tv/res','-o',build/'resources.zip')
run(tools/'aapt2.exe','link','-I',android_jar,'--manifest',root/'android-tv/AndroidManifest.xml',
    '--min-sdk-version','23','--target-sdk-version','35','-o',build/'unsigned.apk',build/'resources.zip')
run(jdk/'bin/javac.exe','--release','8','-encoding','UTF-8','-classpath',android_jar,'-d',classes,
    *sorted((root/'android-tv/src').rglob('*.java')))
run(jdk/'bin/jar.exe','--create','--file',build/'classes.jar','-C',classes,'.')
run(jdk/'bin/java.exe','-cp',tools/'lib/d8.jar','com.android.tools.r8.D8','--lib',android_jar,
    '--min-api','23','--output',dex,build/'classes.jar')
with zipfile.ZipFile(build/'unsigned.apk','a') as archive:
 for file in dex.glob('*.dex'):archive.write(file,file.name)
run(tools/'zipalign.exe','-f','4',build/'unsigned.apk',build/'aligned.apk')
keystore=root/'.tools/android/yturok-tv.keystore'
password=root/'.tools/android/signing-password.txt'
if not keystore.exists():
 password.write_text(secrets.token_urlsafe(32),encoding='utf-8')
 run(jdk/'bin/keytool.exe','-genkeypair','-alias','yturok-tv','-keystore',keystore,
     '-storepass:file',password,'-keypass:file',password,'-keyalg','RSA','-keysize','2048',
     '-validity','10000','-dname','CN=yturokTV, OU=Google TV, O=yturokTV')
apk=out/'yturokTV-GoogleTV.apk'
os.environ['YT_TV_STORE_PASSWORD']=password.read_text('utf-8').strip()
os.environ['YT_TV_KEY_PASSWORD']=os.environ['YT_TV_STORE_PASSWORD']
run(jdk/'bin/java.exe','-jar',tools/'lib/apksigner.jar','sign','--ks',keystore,
    '--ks-key-alias','yturok-tv','--ks-pass','env:YT_TV_STORE_PASSWORD','--key-pass','env:YT_TV_KEY_PASSWORD',
    '--out',apk,build/'aligned.apk')
run(jdk/'bin/java.exe','-jar',tools/'lib/apksigner.jar','verify',apk)
print('Signed APK:',apk, '| bytes:',apk.stat().st_size)
