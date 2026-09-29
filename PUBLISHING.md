# Publicar el MCP y los SDKs — checklist para Dani

Todo está preparado y verificado en local (tests, build, `npm pack --dry-run`, `python -m build`,
`twine check`, `mcp-publisher validate`, `mcpb pack`). Lo único que falta son **tus cuentas**.
Sigue el orden: cada paso depende del anterior.

| # | Canal | Qué publica | Necesita | Tiempo |
|---|-------|-------------|----------|--------|
| 0 | Decidir namespace | nada | leer §0 | 2 min |
| 1 | npm | `catastro-gps-mcp@1.1.0` y `catastrogps@1.0.0` | cuenta npm con 2FA | 5 min |
| 2 | PyPI | `catastrogps==1.0.0` | cuenta PyPI con 2FA + token | 10 min |
| 3 | Registro oficial MCP | `es.catastrogps/catastro-gps` | DNS de catastrogps.es (o GitHub) | 15 min |
| 4 | Glama | ficha reclamada | GitHub | 5 min |
| 5 | Smithery | bundle MCPB | cuenta Smithery | 10 min |
| 6 | PulseMCP | nada (se alimenta del registro) | — | 0 |
| 7 | mcp.so | ficha | cuenta GitHub | 5 min |

---

## 0. Namespace del registro oficial: dominio o GitHub

El nombre del servidor en el registro va grabado en `package.json` (`mcpName`) y en
`server.json` (`name`), y **tienen que coincidir**. Está puesto
`es.catastrogps/catastro-gps` (verificación por DNS). La alternativa es
`io.github.TheHiddenPandaDev/catastro-gps` (verificación por GitHub).

| | Dominio `es.catastrogps/…` | GitHub `io.github.TheHiddenPandaDev/…` |
|---|---|---|
| Lo que ve el cliente | La marca, igual que Predio (`com.prediohq/catastro`) | El nombre de la organización de GitHub, que no es la marca |
| Qué hay que hacer | Un registro TXT en la raíz de `catastrogps.es` + una clave privada guardada | `mcp-publisher login github` y ya |
| Requisito | Acceso al DNS de catastrogps.es; OpenSSL 3 (`brew install openssl@3`) | Ser **Owner** de la org TheHiddenPandaDev (lo eres: rol `admin`) |
| Riesgo | Si se pierde la clave, se genera otra y se cambia el TXT | Ninguno; se puede migrar al dominio más adelante (nombre nuevo) |
| CI futuro | La clave privada va como secreto | Token de GitHub con `read:org` |

**Recomendación: dominio.** La ficha es lo primero que se compara con Predio y el nombre de
marca da confianza. Si hoy no puedes tocar el DNS, cambia las dos cadenas a
`io.github.TheHiddenPandaDev/catastro-gps` (en `package.json` → `mcpName`, en `server.json` →
`name`, y el comentario `mcp-name` del README), `npm test` (un test comprueba que coinciden) y
sigue con GitHub. Hazlo **antes** del paso 1: el `mcpName` viaja dentro del paquete de npm.

---

## 1. npm

Requisitos: cuenta en npmjs.com con 2FA activado ("Authorization and publishing"). Eres dueño
de `catastro-gps-mcp` (1.0.2 ya publicado). El nombre `catastrogps` está libre (comprobado el
29-sep-2026).

```bash
npm login
npm whoami

cd ~/Documents/development/thp/catastrato/mcp
git pull
npm ci
npm publish --access public
npm view catastro-gps-mcp version

cd ~/Documents/development/thp/catastrato/sdks/javascript
git pull
npm ci
npm publish --access public
npm view catastrogps version
```

`prepublishOnly` ejecuta typecheck, tests y build: si algo falla, no se publica. npm pedirá el
código 2FA en cada `publish`.

---

## 2. PyPI

Requisitos: cuenta en pypi.org con 2FA y un **API token** (Account settings → API tokens →
"Entire account" la primera vez; tras publicar, sustitúyelo por uno limitado al proyecto
`catastrogps`). El nombre está libre (comprobado el 29-sep-2026).

```bash
cd ~/Documents/development/thp/catastrato/sdks/python
python3 -m venv .venv && source .venv/bin/activate
pip install -U build twine pytest httpx
pytest -q
rm -rf dist && python -m build
twine check dist/*
twine upload dist/*
```

Usuario `__token__`, contraseña el token `pypi-…`. Comprueba en https://pypi.org/project/catastrogps/.

Opcional antes: probarlo en TestPyPI con `twine upload -r testpypi dist/*` (cuenta aparte).

---

## 3. Registro oficial MCP (registry.modelcontextprotocol.io)

Requisito: el paso 1 hecho (el registro comprueba que `catastro-gps-mcp@1.1.0` existe en npm
y que su `package.json` lleva el mismo `mcpName`).

Instalar `mcp-publisher`:

```bash
brew install mcp-publisher
mcp-publisher --help
```

### 3a. Con dominio (recomendado)

```bash
brew install openssl@3
OPENSSL=/opt/homebrew/opt/openssl@3/bin/openssl
mkdir -p ~/.mcp-registry && cd ~/.mcp-registry
$OPENSSL genpkey -algorithm Ed25519 -out catastrogps-es.pem
PUBLIC_KEY="$($OPENSSL pkey -in catastrogps-es.pem -pubout -outform DER | tail -c 32 | base64)"
echo "catastrogps.es. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

1. Crea ese TXT **en la raíz** de `catastrogps.es`. El DNS está en **Vercel**
   (`ns1.vercel-dns.com`, comprobado el 29-sep-2026): Vercel → Domains → catastrogps.es →
   DNS Records → Add, *Name* vacío (raíz), *Type* TXT, *Value* lo que va entre comillas
   (`v=MCPv1; k=ed25519; p=…`). No en `_mcp.catastrogps.es`: tiene que ser la raíz. Ya hay
   TXT de SPF, DMARC y Google: no se tocan, se añade uno más.
2. Espera a que se vea: `dig +short TXT catastrogps.es` debe listar el `v=MCPv1`.
3. Guarda `catastrogps-es.pem` en tu gestor de contraseñas. No va a ningún repo.

```bash
cd ~/Documents/development/thp/catastrato/mcp
PRIVATE_KEY="$($OPENSSL pkey -in ~/.mcp-registry/catastrogps-es.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain catastrogps.es --private-key "${PRIVATE_KEY}"
mcp-publisher validate
mcp-publisher publish
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=es.catastrogps"
```

### 3b. Con GitHub (si no hay DNS)

Primero cambia el namespace (§0) y publica en npm con ese `mcpName`. Después:

```bash
cd ~/Documents/development/thp/catastrato/mcp
mcp-publisher login github
mcp-publisher publish
```

En cada versión nueva: sube `version` en `package.json`, `server.json` (dos sitios),
`manifest.json`, `smithery.yaml` y `src/version.ts` (el test `release metadata` falla si no
coinciden), `npm publish` y `mcp-publisher publish`.

---

## 4. Glama (glama.ai/mcp/servers)

Glama indexa GitHub solo. El repo lleva `glama.json` con `DanielRomanMartinez` como maintainer,
que es lo que exige Glama para reclamar un servidor de una organización.

1. Busca "catastro" en https://glama.ai/mcp/servers. Si no sale, "Add server" con la URL
   `https://github.com/TheHiddenPandaDev/catastro_gps_mcp`.
2. En la ficha, "Login with GitHub to claim".
3. Una vez reclamada: revisa nombre, descripción y categoría (Location / Real estate). Glama da
   una nota de calidad que sube si puede arrancar el servidor e inspeccionar las tools; para eso
   pide configurar en su panel el comando (`npx -y catastro-gps-mcp`) y la variable
   `CATASTROGPS_API_KEY`. Usa una clave **del plan gratis**, dedicada a Glama, para poder
   revocarla.

---

## 5. Smithery (smithery.ai)

Smithery ya no construye servidores stdio desde `smithery.yaml`: publica una URL remota o un
**bundle MCPB**. No hay servidor remoto desplegado, así que va por bundle. El `smithery.yaml`
del repo se queda para Glama y otros índices que aún lo leen.

```bash
cd ~/Documents/development/thp/catastrato/mcp
npm ci && npm run build
npm prune --omit=dev
npx -y @anthropic-ai/mcpb pack . catastro-gps-mcp-1.1.0.mcpb
npm ci

npx -y @smithery/cli login
npx -y @smithery/cli mcp publish ./catastro-gps-mcp-1.1.0.mcpb -n thehiddenpanda/catastro-gps
```

El mismo `.mcpb` sirve para instalar con doble clic en Claude Desktop: súbelo también como
asset de un release de GitHub (`gh release create v1.1.0 catastro-gps-mcp-1.1.0.mcpb`).

Si la CLI de Smithery pide otro formato de nombre o de login, manda su ayuda
(`npx @smithery/cli mcp publish --help`), no este documento.

---

## 6. PulseMCP (pulsemcp.com)

No acepta envíos: lee el registro oficial y GitHub. Tras el paso 3 aparece solo en unos días.
Si en una semana no está, usa su formulario de sugerencias con la URL del repo.

---

## 7. mcp.so

1. https://mcp.so/submit → "Login with GitHub".
2. URL: `https://github.com/TheHiddenPandaDev/catastro_gps_mcp` (tiene que ser un repo
   público: lo es).
3. Completa el borrador: nombre "Catastro GPS", descripción del README, categoría
   "Location Services". Al guardar se publica tras revisión (gratis; hay una opción de pago
   para saltarse la cola que no hace falta).

---

## Después de publicar

- Comprueba que `npx -y catastro-gps-mcp` arranca con una clave real y que `search_address`
  devuelve una referencia para "Calle Mallorca 213, Barcelona".
- Anota fechas y URLs de cada ficha en Jira (CAT) y en `thp-docs/productos/catastro-gps.md`.
- El repo de SDKs (`TheHiddenPandaDev/catastro_gps_sdks`) es **privado**: los paquetes no lo
  enlazan. Si quieres que npm/PyPI muestren "Repository", hazlo público y añade la URL.
