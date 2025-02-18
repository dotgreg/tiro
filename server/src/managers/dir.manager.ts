import execa = require("execa");
import { exists } from "fs";
import { each, isNumber, random, uniq } from "lodash";
import { getDefaultFormatCodeSettings } from "typescript";
import { iApiDictionary } from "../../../shared/apiDictionary.type";
import { cleanPath } from "../../../shared/helpers/filename.helper";
import { sharedConfig } from "../../../shared/shared.config";
import { iFile, iFolder } from "../../../shared/types.shared";
import { backConfig } from "../config.back";
import { getServerTaskId, setServerTaskId } from "../routes";
import { fileExists, fileStats, isDir } from "./fs.manager";
import { log } from "./log.manager";
import { p } from "./path.manager";
import { getPlatform } from "./platform.manager";
import { searchWithRipGrep } from "./search/search-ripgrep.manager";
import { ServerSocketManager } from './socket.manager'
import {fdir} from 'fdir';
import { scanFolderAsStream } from "./foldersScan/folderScan.manager";
import { perf } from "./performance.manager";
const h = `[DIR SCAN]`
const shouldLog = sharedConfig.server.log.verbose


var fs = require('fs')
const path = require('path')



export const createDir = async (path: string, mask: number = 0o775): Promise<null | string> => {
	return new Promise((resolve, reject) => {
		fs.mkdir(path, 0o775, (err) => {
			if (err) {
				if (err.code == 'EEXIST') resolve(null); // ignore the error if the folder already exists
				else reject(err.message); // something else went wrong
			} else {
				resolve(null); // successfully created folder
			}
		});
	});
}

export const fileNameFromFilePath = (path: string): string => {
	let fileName = path.split('/').join('_')
	fileName = fileName.split('\\').join('_')
	return fileName
}




























export let dirDefaultBlacklist = ['.resources','.history', '_resources', '.DS_Store']

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// NEW METHOD USING STREAM
// 
export const scanDirForFolders = (folderPath: string): iFolder => {
	// let endPerf = perf('scanDirForFolders2 ' + JSON.stringify(folderPath))
	const fullFolderPath = cleanPath(`${backConfig.dataFolder}${folderPath}`)
	let relativeFolder = cleanPath(fullFolderPath).replace(cleanPath(backConfig.dataFolder), '')
	if (!fileExists(fullFolderPath)) return
	const resultFolder: iFolder = {
		path: relativeFolder,
		hasChildren: false,
		title: path.basename(fullFolderPath),
		key: relativeFolder
	};
	var folderStats = fileStats(fullFolderPath)
	if (folderStats.isDirectory()) {
		resultFolder.hasChildren = true 
		resultFolder.children = []
		let subfolders = scanFolderAsStream(fullFolderPath, false, dirDefaultBlacklist)

		// for each item, check if there is a dir inside, if yes, stop the scan
		let breakIfFound = true
		let children:iFolder[] = []
		each(subfolders, subfolder => {
			let relPath = cleanPath(`${relativeFolder}/${subfolder}`)
			let absPath = cleanPath(`${fullFolderPath}/${subfolder}`)
			let subsubfolders = scanFolderAsStream(absPath, breakIfFound, dirDefaultBlacklist)
			let hasFolderChildren = subsubfolders.length > 0
			children.push({
				path: relPath,
				hasChildren: false,
				hasFolderChildren,
				title: subfolder,
				key: relPath
			})
		})
		resultFolder.hasFolderChildren = children.length > 0
		resultFolder.children = children
	}
	// endPerf()
	// console.log(resultFolder)
	return resultFolder
}

















































export const scanDirForFolders2 = (folderPath: string): iFolder => {
	const fullFolderPath = cleanPath(`${backConfig.dataFolder}${folderPath}`)
	let relativeFolder = cleanPath(fullFolderPath).replace(cleanPath(backConfig.dataFolder), '')
	if (!fileExists(fullFolderPath)) return
	const resultFolder: iFolder = {
		path: relativeFolder,
		hasChildren: false,
		title: path.basename(fullFolderPath),
		key: relativeFolder
	};
	var folderStats = fileStats(fullFolderPath)
	if (folderStats.isDirectory()) {
		resultFolder.hasChildren = true
		resultFolder.children = []
		// resultFolder.children.push(childFolder)
		const items = new fdir()
			// .withFullPaths()
			.onlyDirs()
			.withMaxDepth(2)
			.exclude((dirName, dirPath) => dirName.startsWith(".") || dirName === "_resources")
			.crawl(fullFolderPath)
			.sync();

		let rawChildren:any = {}
		each(items, item => {
			item = item.replace(fullFolderPath, "")
			let pathArr = item.split("/").filter(it => it !== "")
			let itemName = pathArr[0]
			// console.log(111, pathArr)
			if (itemName === "") return
			let hasFolderChildren = pathArr.length > 1
			if (!rawChildren[itemName]) rawChildren[itemName] = {itemName, hasFolderChildren}
			else if (!rawChildren[itemName].hasFolderChildren && hasFolderChildren) rawChildren[itemName].hasFolderChildren = true
		})
		// console.log(22, rawChildren)
		let children:iFolder[] = []
		each(rawChildren, rc => {
			let relativeChildFolder = p(`${fullFolderPath}/${rc.itemName}`).replace(cleanPath(backConfig.dataFolder), '')
			children.push({
				path: relativeChildFolder,
				hasChildren: false,
				hasFolderChildren: rc.hasFolderChildren,
				title: rc.itemName,
				key: relativeChildFolder
			})
		})
		resultFolder.hasFolderChildren = children.length > 0
		resultFolder.children = children
		// console.log(22, children)

	}
	return resultFolder
}




export const lastFolderFilesScanned = { value: "" }
export const rescanEmitDirForFiles = async (serverSocket2: ServerSocketManager<iApiDictionary>) => {
	let apiAnswer = await scanDirForFiles(lastFolderFilesScanned.value, serverSocket2)
	if (typeof (apiAnswer) === 'string') return log(apiAnswer)
	serverSocket2.emit('getFiles', { files: apiAnswer, idReq: '-' })
}

export const scanDirForFiles = async (path: string, serverSocket2?: ServerSocketManager<iApiDictionary>): Promise<iFile[] | string> => {
	return new Promise((res, rej) => {
		searchWithRipGrep({
			term: '',
			folder: path,
			typeSearch: 'folder',
			titleSearch: false,
			onSearchEnded: async answer => {
				res(answer.files)
			},
			onRgDoesNotExists: () => { serverSocket2 && serverSocket2.emit('onServerError', { status:"NO_RIPGREP_COMMAND_AVAILABLE", platform: getPlatform() })}
		})
	})
}











































// export const scanDirForFoldersOLD = (folderPath: string): iFolder => {
// 	const fullFolderPath = cleanPath(`${backConfig.dataFolder}${folderPath}`)

// 	const start = Date.now()

// 	if (!fileExists(fullFolderPath)) return
// 	var folderStats = fileStats(fullFolderPath)
// 	let relativeFolder = cleanPath(fullFolderPath).replace(cleanPath(backConfig.dataFolder), '')
// 	const resultFolder: iFolder = {
// 		path: relativeFolder,
// 		hasChildren: false,
// 		title: path.basename(fullFolderPath),
// 		key: relativeFolder
// 	};
// 	if (folderStats.isDirectory()) {
// 		resultFolder.hasChildren = true
// 		resultFolder.children = []
// 		fs.readdirSync(fullFolderPath).map((child) => {

// 			let fullChildPath = fullFolderPath + '/' + child

// 			try {
// 				let childStats = fileStats(fullChildPath)
// 				if (
// 					childStats.isDirectory() &&
// 					dirDefaultBlacklist.indexOf(path.basename(child)) === -1
// 				) {
// 					let relativeChildFolder = cleanPath(fullChildPath).replace(cleanPath(backConfig.dataFolder), '')

// 					const isFolder = isChildAFolder(child, fullFolderPath)
// 					if (isFolder) { resultFolder.hasFolderChildren = true }

// 					let childFolder: iFolder = {
// 						hasChildren: false,
// 						path: relativeChildFolder,
// 						title: path.basename(relativeChildFolder),
// 						key: relativeChildFolder
// 					}

// 					// WITHOUT READDIR 0.026s
// 					// WITH READDIR fullChildPath 0.026s kiff kiff
// 					// WITH READDIR fullChildPath + loop 0.026s kiff kiff
// 					// WITH READDIR fullChildPath + loop + lstatSync + isDir 0.300s /10 perfs
// 					// WITH READDIR fullChildPath + loop + checkDir from name 0.030s x10 times faster
// 					// LAST + LOG EACH ITE = 4s = PERFS /100!!!

// 					const subchildren: string[] = fs.readdirSync(fullChildPath)
// 					// for (let i = 0; i < subchildren.length; i++) {
// 					each(subchildren, child2 => {
// 						// const child2 = subchildren[i];
// 						// let fullChild2Path = fullChildPafullChildPathth + '/' + child2

// 						const isFolder = isChildAFolder(child2, fullChildPath)
// 						if (isFolder) {
// 							childFolder.hasFolderChildren = true
// 							// break; 
// 							// breaking each lodash
// 							return false;
// 						}

// 						// 10x times slower
// 						// let child2Stats = fs.lstatSync(fullChild2Path)
// 						// if (child2Stats.isDirectory() && dirDefaultBlacklist.indexOf(path.basename(child2)) === -1) {
// 						//     childFolder.hasChildren = true
// 						//     break;
// 						// }
// 					})

// 					resultFolder.children.push(childFolder)
// 				}
// 			} catch (error) {
// 				log("scanDirForFolders => error " + error);
// 			}
// 		});
// 	}
// 	// console.log(h, folderPath, (Date.now() - start) / 1000);
// 	return resultFolder
// }


// const isChildAFolder = (childPath: string, parentPath: string): boolean => {
// 	// take in account .folder like .tiro and .trash
// 	let child2temp = childPath[0] === '.' ? childPath.substr(1) : childPath
// 	const hasExtension = child2temp.split('.').length > 1

// 	if (
// 		dirDefaultBlacklist.indexOf(path.basename(childPath)) === -1 &&
// 		!hasExtension
// 	) {
// 		// check if it is a folder for real
// 		// (expensive but should not happen often so thats ok
// 		if (isDir(parentPath + "/" + childPath)) {
// 			if (parentPath.includes("2222")) console.log(h, "CHILD FOLDER DEteCteD (stopping loop) =>", childPath, "in", parentPath);
// 			// if (parentPath.includes("222")) {
// 			// }
// 			// childFolder.hasChildren = 
// 			return true
// 		}
// 	}
// 	return false
// }










// test1
// avec 6k folders + processing js array + uniq 0.385
// sans processing 0.367 avec 0.377, mhhh
// sans processing 0.367 CONSOLELOG et avec 0.407
// sans processing 0.367 CONSOLELOG et OBJ ordering 0.389
// const h = `=============`

// EXECA VERSION NOT USED
// export const scanDirForFolders3 = (folderPath: string): any => {
// 	if (folderPath !== "--test--") return
// 	// console.log(h, "woooop", folderPath);
// 	const normalSearchParams = [
// 		backConfig.dataFolder,
// 		'--files',
// 		'--sort-files',
// 	]
// 	const start = Date.now()
// 	console.log(h, "start ", normalSearchParams);
// 	const path = require('path')
// 	exec@(backConfig.rgPath, normalSearchParams).then((res) => {

// 		// /i/get/that/one
// 		// split i get that one
// 		// create obj[i][get][that][one] if doesnt exists

// 		// ensuite simplement commencer {name: your notes, children:[...]}
// 		// each (obj[i], folder => {}) en recurs!
// 		// create obj[i][get][that][one] if doesnt exists

// 		console.log(h, (Date.now() - start) / 1000);
// 		const arr = res.stdout.split("\n")

// 		// let arr2 = []
// 		// each(arr, (f) => {
// 		// 	let dir = path.dirname(f).replace(backConfig.dataFolder, '').replace('\\','/')
// 		// arr2.push(dir)
// 		// 	})
// 		// })
// 		// arr2 = uniq(arr2)
// 		// console.log(h, arr2);

// 		let resObj2: iFolder = {
// 			title: 'root',
// 			key: 'root',
// 			path: 'root',
// 			children: []
// 		}

// 		const util = require('util')
// 		const cl = (obj: any, d = 4) => {
// 			console.log(util.inspect(obj, { showHidden: false, depth: d, colors: true }))
// 		}

// 		let resObj: any = {}
// 		each(arr, (f) => {
// 			let dir = path.dirname(f).replace(backConfig.dataFolder, '').replace('\\', '/')
// 			let pathArr = dir.split('/')
// 			let cObj = resObj
// 			let absPath = ''
// 			each(pathArr, folder => {
// 				absPath = absPath + (absPath === '' ? "" : "/") + folder
// 				if (!cObj[folder]) cObj[folder] = { ___path: absPath }
// 				cObj.___hasChildren = true
// 				// if (!cObj.___children) cObj.___children = []
// 				// cObj.___children.push(cObj[folder])
// 				cObj = cObj[folder]
// 			})
// 		})
// 		// cl(resObj);

// 		const loop = (obj: any) => {
// 			if (obj.___hasChildren) obj.children = []
// 			each(obj, (child, nameChild) => {
// 				if (!isNumber(nameChild) && !nameChild.startsWith("___")) {
// 					// console.log(nameChild);
// 					child = loop(child)
// 					obj.children.push(child)
// 				}
// 			})
// 			// console.log(obj);
// 			return obj
// 		}
// 		let r = loop(resObj[''])
// 		cl(r, 4);



// 		// each

// 		// const iterate = (obj) => {
// 		// 	Object.keys(obj).forEach(key => {
// 		// 		// console.log(`key: ${key}, value: ${obj[key]}`)
// 		// 		if (!obj[key].children) obj[key].children = []
// 		// 		if (!key.startsWith("___")) {
// 		// 			obj[key].children.push(iterate(obj[key]))
// 		// 		}
// 		// 	})
// 		// }
// 		// console.log(iterate(resObj));



// 		// let nObj
// 		// const iterateInObj = (obj:any, nobj?:any):any => {

// 		// 	each(obj, (prop, name) => {
// 		// 		obj[name] = iterateInObj(obj) 
// 		// 	})
// 		// 	return obj
// 		// }
// 		// let nobj = iterateInObj(resObj)

// 		// let res3: iFolder = {
// 		// 	title: 'root',
// 		// 	key: 'root',
// 		// 	path: 'root',
// 		// 	children: []
// 		// }

// 		// const generateiFoldersFromObj = (obj: any, res?: iFolder): iFolder[] => {
// 		// 	each(obj, (prop, name) => {
// 		// 		res.children.push({
// 		// 			title: name,
// 		// 			key: prop.___path,
// 		// 			path: prop.___path,
// 		// 			hasChildren: prop.___hasChildren,
// 		// 			children: generateiFoldersFromObj(res.children, obj[name])
// 		// 		})
// 		// 	})
// 		// 	return res.children
// 		// }

// 		// const generateiFolderFromObj = (obj: any, res?: iFolder): iFolder => {
// 		// 	if (!res) {
// 		// 		res = {
// 		// 			title: 'root',
// 		// 			key: 'root',
// 		// 			path: 'root',
// 		// 			children: []
// 		// 		}
// 		// 	}
// 		// 	let i = 0
// 		// 	each(obj, (prop, name) => {
// 		// 		res.children.push({
// 		// 			title: name,
// 		// 			key: prop.___path,
// 		// 			path: prop.___path,
// 		// 			hasChildren: prop.___hasChildren,
// 		// 			children: [] 
// 		// 		})
// 		// 		res.children[i]
// 		// 		i++
// 		// 	})
// 		// 	return res
// 		// }
// 		// let res4 = generateiFoldersFromObj(resObj)
// 		// cl(res3);

// 		console.log(h, (Date.now() - start) / 1000);

// 	})
// 	// ripGrepStreamProcess1.stdout.on('data', async dataRaw => {
// 	// 	console.log(h, 1, dataRaw);
// 	// })

// 	// ripGrepStreamProcess1.stdout.on('close', dataRaw => {
// 	// 	console.log(h, 2, dataRaw);
// 	// })

// 	return {}
// }



// export const scanDirForFolders = async (folderPath: string): Promise<iFolder | undefined> => {
// 	const fullFolderPath = cleanPath(`${backConfig.dataFolder}${folderPath}`)
// 	console.log(1111, fullFolderPath)
// 	// const items = await new fdir().withFullPaths().onlyDirs().crawl(fullFolderPath).withPromise();
// 	const items = new fdir().withFullPaths().onlyDirs().withMaxDepth(1).crawl(fullFolderPath).sync();
// 	// console.log(123, items)

//   const resultFolder: iFolder = {
//     path: '',
//     hasChildren: false,
//     title: '',
//     key: '',
//   };

//   if (!fileExists(folderPath)) return undefined;

//   const folderStats = fileStats(folderPath);
//   const relativeFolder = cleanPath(folderPath).replace(cleanPath(backConfig.dataFolder), '');

//   resultFolder.path = relativeFolder;
//   resultFolder.title = path.basename(folderPath);
//   resultFolder.key = relativeFolder;

//   if (folderStats.isDirectory()) {
//     resultFolder.hasChildren = true;
//     resultFolder.children = [];

//     for (const child of items) {
//       const fullChildPath = child;
//       try {
//         const childStats = fileStats(fullChildPath);

//         if (childStats.isDirectory() && dirDefaultBlacklist.indexOf(path.basename(child)) === -1) {
//           const relativeChildFolder = cleanPath(fullChildPath).replace(cleanPath(backConfig.dataFolder), '');

//           const isFolder = await isChildAFolder(child, folderPath);
//           if (isFolder) resultFolder.hasFolderChildren = true;

//           const subchildrenItems = new fdir().withFullPaths().onlyDirs().withMaxDepth(1).crawl(fullChildPath).sync();
//           const subchildren = subchildrenItems.map((subchild) => path.basename(subchild));

//           const childFolder: iFolder = {
//             hasChildren: false,
//             path: relativeChildFolder,
//             title: path.basename(relativeChildFolder),
//             key: relativeChildFolder,
//           };

//           for (const subchild of subchildren) {
//             const isSubchildFolder = await isChildAFolder(subchild, fullChildPath);
//             if (isSubchildFolder) {
//               childFolder.hasFolderChildren = true;
//               break;
//             }
//           }

//           resultFolder.children.push(childFolder);
//         }
//       } catch (error) {
//         log("scanDirForFolders => error " + error);
//       }
//     }
//   }
//   console.log(333, resultFolder)
//   return resultFolder;
// };

// const isChildAFolder = async (childPath: string, parentPath: string): Promise<boolean> => {
//   const child2temp = childPath[0] === '.' ? childPath.substr(1) : childPath;
//   const hasExtension = child2temp.split('.').length > 1;

//   if (dirDefaultBlacklist.indexOf(path.basename(childPath)) === -1 && !hasExtension) {
//     const isChildDirectory = new fdir().withFullPaths().onlyDirs().withMaxDepth(1).crawl(parentPath + '/' + childPath).sync();
//     if (isChildDirectory) return true;
//   }

//   return false;
// };
