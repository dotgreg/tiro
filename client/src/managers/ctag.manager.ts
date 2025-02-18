import { sharedConfig } from "../../../shared/shared.config"
import { getApi } from "../hooks/api/api.hook"
const h = `[CTAG MANAGER]`
let shouldLog = sharedConfig.client.log.verbose
shouldLog = true

// inside code app
// const getHardcodedTags = () => {
//     return {iframeOLD: iframeCtag}
// }
// if not present, fallback to download from dev/plugins github for the moment
const baseCtag = ["epub", "pdf", "iframe", "web", "smartlist"]
const getBaseCtagContent = (ctagName:string, cb:(txt:string)=>void) => {
  
  const url = `https://raw.githubusercontent.com/dotgreg/tiro-notes/dev/plugins/${ctagName}/${ctagName}.js`
  let addedOpts = ``
  if (ctagName === "epub") addedOpts = `open:true, size: "80%"`
  if (ctagName === "pdf") addedOpts = `open:true`
  if (ctagName === "web") addedOpts = `"search_engines": {
    "default":"https://search.bowlman.org/search?q=",
    "g":"https://www.google.com/search?q=",
    "m": "https://www.google.com/maps/search/"
  }`
  const baseCtagTxt = `
  [[script]]
  return api.utils.loadCustomTag("${url}",\`{{innerTag}}\`,{${addedOpts}})
  [[script]]
  `

  shouldLog && console.log(`${h} : ctag "${ctagName}" not present in tiro/tags but part of the base, return base config`, {baseCtagTxt})
  cb(baseCtagTxt)
}

const getCtagLegacyContent = (ctagName:string, cb) => {
  getApi(api => {
    api.file.getContent(`/.tiro/tags/${ctagName}.md`, ncontent => {
        cb(ncontent)
    }, {
        onError: () => {
            // if not present, fallback to download from dev/custom-tags github for the moment
            if (baseCtag.includes(ctagName)) {
              getBaseCtagContent(ctagName, txt => {
                cb(txt)
              })
            } else {
              cb(null)
            }
        }
    })
  })
}


export const getCtagContent = (ctagName: string, cb:(ctagContent:string|null) => void) => {
    // let intCtags = getHardcodedTags()
    // 1 HARDCODED
    // if (intCtags[ctagName]){
    //     cb(intCtags[ctagName])
    // } else {
      
    // 2 PLUGINS
    getApi(api => {
      api.plugins.get(ctagName, "tag", res => {
        if (res && res.type === "tag") {
          cb(res.code)
        } else {
          //3 W LEGACY CTAG SYSTEM FALLBACK
          if (ctagName === "iframe") ctagName = "web"
          getCtagLegacyContent(ctagName, res2 => {
            cb(res2)
          })
        }
      })
    })
        
    // }
}

export const getCtagList = () => {

}



//
// internal CTAGS
//
const iframeCtag = () => `
[[script]]
const style = \`<style>
.ctag-iframe-wrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
#ctag-iframe {
  border: none;
  transform: scale(0.67);
  width: 150%!important;
  height: 150vh!important;
  transform-origin:top left;
}
</style>\`
const contentStyle = \`
<style>
img {
		max-width: 100%!important;
		height: auto!important;
}
body, html {
		font-family: sans-serif;
}
</style>
\`

let content = \`{{innerTag}}\`
let htmlHead = \`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>\`
let htmlFooter = \`</body></html>\`

var meta = document.createElement('meta');
meta.charset = "utf-8";
window.document.head.appendChild(meta);
document.head.innerHTML += '<meta charset="utf-8">'

let iframeContent = ""
if (content.startsWith("http")) {
  iframeContent=\`src="\${content}"\`
} else {
  window.document.body.innerHTML =  contentStyle + decodeURIComponent(content) 
}

api.utils.resizeIframe("100%");
setTimeout(() => {
  api.utils.resizeIframe("100%");
}, 1000)


return \`\${style}<div class="ctag-iframe-wrapper"><iframe \${iframeContent} id="ctag-iframe"></iframe></div>\`

[[script]]
`
