import { isArray } from "lodash"
import { iApiDictionary } from "../../../../shared/apiDictionary.type"
import { getDateObj } from "../../../../shared/helpers/date.helper"
import { sleep } from "../../helpers/sleep.helper"
import { scanDirForFiles } from "../dir.manager"
import { createFileHistoryVersion, TEST_fileHistory_internals } from "../fileHistory.manager"
import { fileExists, openFile } from "../fs.manager"
import { testHelpers } from "../test.helpers"

const folder = testHelpers.fs.params.folderPath
const testFilePath = folder + '/folder1/file_test.md'
const {getHistoryFile, processFileHistoryHousekeeping} = TEST_fileHistory_internals

// FUNCS
const TEST_createHistFileInfos = (datestr:string, content:string) => {
    const data:iApiDictionary["createHistoryFile"] = {
        filePath: testFilePath,
        content: content,
        historyFileType: 'enter',
    }
    let date = getDateObj(datestr)
    let historyFile = getHistoryFile(data.filePath, date, data.historyFileType)
    return {historyFile, date, data}
}


// these should be one left w1_
let f1 = TEST_createHistFileInfos("01/10/2023 10:20", "1111111111")
let f2 = TEST_createHistFileInfos("01/10/2023 15:20", "222222222222")

// these should be one left d15_11
let f3 = TEST_createHistFileInfos("10/15/2023 15:20", "33333333333")
let f4 = TEST_createHistFileInfos("10/15/2023 16:20", "444444444444"
)
// these should be kept
let f5 = TEST_createHistFileInfos("12/01/2023 01:20", "55555555555555")

let date_housekeeping = getDateObj("12/01/2023 10:20")
let date_housekeeping_beforeOneDay = getDateObj("12/02/2023 10:10")
let date_housekeeping_afterOneDay = getDateObj("12/02/2023 10:30")


let f6_disableString = TEST_createHistFileInfos("12/01/2023 01:20", "--disable-history-- sfadkjfdlsajlfkdas 55555555555555")












// TESTS

test('getHistoryFile',  () => {
    const exp = {"extension": "md", "filenameWithoutExt": "file_test_enter___f10-31-2023_10h20m", "folder": "/_auto_tests/folder1/.history/file_test/", "name": "file_test_enter___f10-31-2023_10h20m.md", "nature": "file", "path": "/_auto_tests/folder1/.history/file_test/file_test_enter___f10-31-2023_10h20m.md", "realname": "file_test_enter___f10-31-2023_10h20m.md"}
    expect(
        getHistoryFile(testFilePath, getDateObj("10/31/2023 10:20"), "enter")
    ).toStrictEqual(exp);
    // ).toStrictEqual(1);
})
test('createFileHistoryVersion: a file history version should be created in history folder', async () => {
    await testHelpers.fs.cleanFolder()

    await createFileHistoryVersion(f1.data, f1.date)
    await createFileHistoryVersion(f2.data, f2.date)

    expect( await fileExists(f1.historyFile.path) ).toStrictEqual(true)
    expect( await openFile(f1.historyFile.path) ).toStrictEqual(f1.data.content)

    expect( await fileExists(f2.historyFile.path) ).toStrictEqual(true)
    expect( await openFile(f2.historyFile.path) ).toStrictEqual(f2.data.content)
})


test('createFileHistoryVersion: should respect --disable-history--', async () => {
    await testHelpers.fs.cleanFolder()
    await createFileHistoryVersion(f6_disableString.data, f6_disableString.date)
    let files = await scanDirForFiles(f6_disableString.historyFile.folder)
    expect(files.length).toStrictEqual(0)

    await testHelpers.fs.cleanFolder()
    await createFileHistoryVersion(f5.data, f5.date)
    let files2 = await scanDirForFiles(f5.historyFile.folder)
    expect(files2.length).toStrictEqual(1)
})

// housekeeping: if last history file +1day, start housekeeping process
test('housekeeping: check housekeeping process results', async () => {
    await testHelpers.fs.cleanFolder()

    await createFileHistoryVersion(f1.data, f1.date)
    await createFileHistoryVersion(f2.data, f2.date)
    await createFileHistoryVersion(f3.data, f3.date)
    await createFileHistoryVersion(f4.data, f4.date)
    await createFileHistoryVersion(f5.data, f5.date)
    
    await processFileHistoryHousekeeping(f1.historyFile, date_housekeeping)

    let files = await scanDirForFiles(f1.historyFile.folder)
    if (!isArray(files)) {
        expect("files").toStrictEqual("is not an array")
    } else {
        // console.log(files)

        let histFileMoreThanMonthExists = 
            files.filter(f => f.filenameWithoutExt === "file_test_enter___d15-10-2023").length === 1
        expect(histFileMoreThanMonthExists).toStrictEqual(true)
        
        let histFileMoreThan6MonthExists = 
            files.filter(f => f.filenameWithoutExt === "file_test_enter___w2-01-2023").length === 1
        expect(histFileMoreThan6MonthExists).toStrictEqual(true)
        
        let histFileLessThanMonthExists = 
            files.filter(f => f.filenameWithoutExt === "file_test_enter___f12-01-2023_01h20m").length === 1
        expect(histFileLessThanMonthExists).toStrictEqual(true)
        
        expect(files.length).toStrictEqual(4)
    }
})

test('housekeeping: if lastrun before one day, do nothing', async () => {
    await testHelpers.fs.cleanFolder()

    // do a first housekeeping
    await createFileHistoryVersion(f5.data, f5.date)
    await processFileHistoryHousekeeping(f1.historyFile, date_housekeeping)
    
    // create some old files
    await createFileHistoryVersion(f1.data, f1.date)
    await createFileHistoryVersion(f2.data, f2.date)
    await createFileHistoryVersion(f3.data, f3.date)
    await createFileHistoryVersion(f4.data, f4.date)
    
    // and do a second one that should not start, thus not compress old files
    await processFileHistoryHousekeeping(f1.historyFile, date_housekeeping_beforeOneDay)
    let files = await scanDirForFiles(f1.historyFile.folder)
    if (!isArray(files)) {
        expect("files").toStrictEqual("is not an array")
    } else {
        // normally should have 4 files if processFileHistoryHousekeeping could have passed
        // so 6 shows it could not pass
        expect(files.length).toStrictEqual(6)
    }

    // the third pass at day+1+10m, should now work
    await processFileHistoryHousekeeping(f1.historyFile, date_housekeeping_afterOneDay)
    let files2 = await scanDirForFiles(f1.historyFile.folder)
    if (!isArray(files2)) {
        expect("files2").toStrictEqual("is not an array")
    } else {
        expect(files2.length).toStrictEqual(4)
    }
})

 


// if we rename a file, it should also rename its history folder
// if we move a file, it should also move its history folder