import searchForm from "./search-form"
import table from "./table"
import pagination from "./pagination"
import handleButton from "./operations"
import {injectTemplate} from "../../utils"
import processFormItems from "../../utils/process-form-items"
import {
    IComponentConfig,
    IComponentTypeEnum, IConfigurator,
    IInjectParent,
    IProcessTemplate,
    IService
} from "../../@types";
import inquirer from "inquirer"
import basePrompt from "../../utils/base-prompt";
import tipsSplit from "../../utils/tips-split";
import componentsPrompt from "../../utils/components-prompt";
import { propValidator, requiredValidator } from "../../utils/validators";
import {getTemplateById} from "../../scanner";
import {makeComponentCode} from "../../vue-template";

export const templateId = "table"

const template = `
<div>
  <div>
    <%searchForm%>
    <%handleButton%>
  </div>
  <%table%>
  <%pagination%>
  <%addForm%>
  <%updateForm%>
  <%components%>
</div>
`

const searchHookTemplate = `
useTableCurd({
  async doSearch() {
    const { status, data, message } = await getTableData({
      query: this.query,
      pageSize: this.pageSize,
      pageNum: this.pageNum
    })
    if (status) {
      this.tableData = data
    } else {
      this.$message.error(message)
    }
  },
  immediate: true<%hasPager%><%hasSelection%><%doDelete%><%doBatchDelete%><%doToggleEnable%><%doMove%>
})`
const doDeleteTemplate = `
// 单个删除
async doDelete(row) {
  const { status, message } = await itemDelete(row)
  if (status) {
    this.$message.success("删除成功")
    this.updateTable()
  } else {
    this.$message.error(message)
  }
}`

const doBatchDeleteTemplate =`
// 批量删除
async doBatchDelete(rows) {
  const { status, message } = await batchDelete(rows)
  if (status) {
    this.$message.success("删除成功")
    this.updateTable()
  } else {
    this.$message.error(message)
  }
}`

const doToggleEnableTemplate = `
// 启用禁用
async doToggleEnable(row) {
  const { status, message } = await toggleEnable({
    id: row.id
  })
  if (status) {
    this.$message.success("操作成功")
    this.updateTable()
  } else {
    this.$message.error(message)
  }
}`

const doMoveTemplate = `
// 上移下移
async handleMove(row, direction) {
  const { status, message } = await move({
    id: row.id,
    direction
  })
  if (status) {
    this.$message.success("操作成功")
    this.updateTable()
  } else {
    this.$message.error(message)
  }
}`

interface ITableOptions {
    formItems: any
    api: string
    tableCols: any
    hasPager: boolean
    deleteApi: string
    batchDeleteApi: string
    toggleEnableApi: string
    moveApi: string
    exportApi: string
    hasSelection: boolean
    addForm: IComponentConfig
    updateForm: IComponentConfig
}

export const processTemplate: IProcessTemplate<ITableOptions> = ({ name, options}, type) => {
    const {
        formItems,
        api,
        tableCols,
        hasPager,
        deleteApi,
        batchDeleteApi,
        toggleEnableApi,
        moveApi,
        exportApi,
        hasSelection,
        addForm,
        updateForm
    } = options

    const hooks = [
        injectTemplate(searchHookTemplate, {
            hasSelection: hasSelection || batchDeleteApi || exportApi ? `,\n  hasSelection: true` : "",
            hasPager: hasPager ? `,\n  hasPager: true` : "",
            doDelete: deleteApi ? `,\n${injectTemplate(doDeleteTemplate, {}, 2)}` : "",
            doBatchDelete: batchDeleteApi ? `,\n${injectTemplate(doBatchDeleteTemplate, {}, 2)}` : "",
            doToggleEnable: toggleEnableApi ? `,\n${injectTemplate(doToggleEnableTemplate, {}, 2)}` : "",
            doMove: moveApi ? `,\n${injectTemplate(doMoveTemplate, {}, 2)}` : "",
        }, 2),
    ]

    if (type === IComponentTypeEnum.component) {
        hooks.unshift(
            `useProps({
                data: Object
            })`
        )
    }

    const services: IService[] = [
        {
            name: "getTableData",
            method: "post",
            api
        },
    ]

    let addFormCode = " "
    if (addForm) {
        addForm.namespace = "add"
        const {
            hooks: addFormHooks,
            props: addFormProps
        } = getTemplateById(addForm.templateId)!.injectParent(addForm)
        hooks.push(...addFormHooks)
        addFormCode = makeComponentCode({
            name: addForm.name,
            props: addFormProps
        })
    }

    let updateFormCode = " "
    if (updateForm) {
        updateForm.namespace = "update"
        const {
            hooks: updateFormHooks,
            props: updateFormProps
        } = getTemplateById(updateForm.templateId)!.injectParent(updateForm)
        hooks.push(...updateFormHooks)
        updateFormCode = makeComponentCode({
            name: updateForm.name,
            props: updateFormProps
        })
    }

    if (deleteApi) {
        services.push({
            name: "itemDelete",
            method: "post",
            api: deleteApi
        })
    }

    if (batchDeleteApi) {
        services.push({
            name: "batchDelete",
            method: "post",
            api: batchDeleteApi
        })
    }

    if (toggleEnableApi) {
        services.push({
            name: "toggleEnable",
            method: "post",
            api: toggleEnableApi
        })
    }

    if (moveApi) {
        services.push({
            name: "move",
            method: "post",
            api: moveApi
        })
    }

    processFormItems({ formItems, hooks, services, depForm: "query" })

    return {
        name,
        template: injectTemplate(template, {
            searchForm: searchForm({
                formItems
            }),
            table: table({
                tableCols,
                hasPager: hasPager,
                hasUpdate: updateForm,
                hasDelete: deleteApi,
                hasToggleEnable: toggleEnableApi,
                hasMove: moveApi,
                hasSelection: hasSelection || batchDeleteApi || exportApi,
            }),
            pagination: hasPager && pagination(),
            handleButton: handleButton({
                hasBatchDel: !!batchDeleteApi,
                addForm: !!addForm
            }),
            addForm: addFormCode,
            updateForm: updateFormCode
        }, 2),
        hooks,
        components: [addForm, updateForm].filter(Boolean),
        services
    }
}

export const injectParent: IInjectParent = ({ namespace }) => {
    const hooks: string[] = [
        `useData(function() {
    return {
      ${namespace}TableData: {}
    }
  })`
    ]

    const props = [ `:data="${namespace}TableData"` ]

    return {
        hooks,
        props,
    }
}

export const configurator: IConfigurator<ITableOptions> = async () => {
    const result = await basePrompt<ITableOptions>({ templateId: "table" })

    const { tableCols } = await inquirer.prompt([
        {
            type: "number",
            message: "表格列数:",
            name: "tableCols",
            default: 1,
        }
    ])

    const options = {
        tableCols: (await promptTableCols({ prefix: "表格列", length: tableCols }))
    } as ITableOptions

    result.options = options

    const { api, formItems } = await inquirer.prompt([
        {
            type: "input",
            message: "数据接口:",
            name: "api",
            validate: requiredValidator
        },
        {
            type: "number",
            message: "查询表单项数量:",
            name: "formItems",
            default: 1,
        },
    ])

    options.api = api

    if (formItems) {
        options.formItems = await promptFormItems({ length: formItems })
    }

    const { operations } = await inquirer.prompt([
        {
            type: "checkbox",
            message: "功能操作？",
            name: "operations",
            choices: [
                { name: "分页", checked: true },
                { name: "新增", checked: true },
                { name: "编辑", checked: true },
                { name: "删除" },
                { name: "批量删除" },
                { name: "启用禁用" },
                { name: "上移下移" },
                { name: "批量导出" },
                { name: "批量操作" },
            ]
        },
    ])

    options.hasPager = operations.includes("分页")

    if (operations.includes("新增")) {
        tipsSplit({ split: `新增` })
        options.addForm = await getTemplateById("dialog-form")!.configurator()
    }

    if (operations.includes("编辑")) {
        tipsSplit({ split: `编辑` })
        options.updateForm = await getTemplateById("dialog-form")!.configurator()
    }

    if (operations.includes("删除")) {
        tipsSplit({ split: `删除` })
        const { deleteApi } = await inquirer.prompt([
            {
                type: "input",
                message: "删除接口:",
                name: "deleteApi",
                validate: requiredValidator
            }
        ])
        options.deleteApi = deleteApi
    }

    if (operations.includes("批量删除")) {
        tipsSplit({ split: `批量删除` })
        const { batchDeleteApi } = await inquirer.prompt([
            {
                type: "input",
                message: "批量删除接口:",
                name: "batchDeleteApi",
                validate: requiredValidator
            }
        ])
        options.batchDeleteApi = batchDeleteApi
    }

    if (operations.includes("启用禁用")) {
        tipsSplit({ split: `启用禁用` })
        const { toggleEnableApi } = await inquirer.prompt([
            {
                type: "input",
                message: "启用禁用接口:",
                name: "toggleEnableApi",
                validate: requiredValidator
            }
        ])
        options.toggleEnableApi = toggleEnableApi
    }

    if (operations.includes("上移下移")) {
        tipsSplit({ split: `上移下移` })
        const { moveApi } = await inquirer.prompt([
            {
                type: "input",
                message: "上移下移接口:",
                name: "moveApi",
                validate: requiredValidator
            }
        ])
        options.moveApi = moveApi
    }

    if (operations.includes("批量导出")) {
        tipsSplit({ split: `批量导出` })
        const { exportApi } = await inquirer.prompt([
            {
                type: "input",
                message: "批量导出接口:",
                name: "exportApi",
                validate: requiredValidator
            }
        ])
        options.exportApi = exportApi
    }

    if (operations.includes("批量操作")) {
        options.hasSelection = true
    }

    result.components = await componentsPrompt()

    return result
}

async function promptTableCols({ prefix = "表单项", length = 0 }) {
    const result = []

    for (let i = 0; i < length; i++) {
        tipsSplit({ split: `${prefix}${i + 1}` })
        const item = await inquirer.prompt([
            {
                type: "input",
                message: `label(中文):`,
                name: `label`,
                validate: requiredValidator
            },
            {
                type: "input",
                message: `prop(英文):`,
                name: `prop`,
                validate: propValidator
            },
        ])
        result.push(item)
    }

    return result
}

export async function promptFormItems({ prefix = "表单项", length = 0, required = false }) {
    const result = []

    for (let i = 0; i < length; i++) {
        tipsSplit({ split: `${prefix}${i + 1}` })
        const item: any = await inquirer.prompt([
            {
                type: "list",
                message: `类型:`,
                name: "type",
                choices: ["input", "select", "date"],
            },
            {
                type: "input",
                message: `label(中文):`,
                name: `label`,
                validate: requiredValidator,
            },
            {
                type: "input",
                message: `prop(英文):`,
                name: `prop`,
                validate: propValidator,
            },
            {   type: "list",
                message: `date类型:`,
                name: `dateType`,
                choices: ["date", "datetime", "year", "month", "daterange", "datetimerange"],
                default: "date",
                when: (answer: any) => answer.type === "date"
            },
            {
                type: "list",
                message: `数据源类型:`,
                name: "source",
                choices: ["接口", "固定项"],
                when: (answer: any) => answer.type === "select"
            },
            {
                type: "input",
                message: `数据源接口api:`,
                name: "api",
                when: (answer: any) => answer.type === "select" && answer.source === "接口",
                validate: requiredValidator
            },
            {
                type: "checkbox",
                message: `数据源依赖表单项prop:`,
                name: "deps",
                when: (answer: any) => answer.type === "select" && answer.source === "接口",
                choices: result.map(d => d.prop)
            },
            {
                type: "number",
                message: `固定项个数:`,
                name: "count",
                default: 2,
                when: (answer: any) => answer.type === "select" && answer.source === "固定项"
            },
        ])
        const length = item.count

        if (length) {
            item.options = await promptSelectOptions({ length, prefix: `${prefix}${i + 1}选项` })
        }

        if (!item.deps?.length) {
            delete item.deps
        }

        result.push(item)
    }

    return result
}

export async function promptSelectOptions({ prefix = '', length = 0 }) {
    const result = []

    for (let i = 0; i < length; i++) {
        tipsSplit({ split: `${prefix}${i + 1}`})
        result[i] = await inquirer.prompt([
            {
                type: "input",
                message: `label(中文):`,
                name: "label",
                validate: requiredValidator,
            },
            {
                type: "input",
                message: `value(英文):`,
                name: "value",
                validate: propValidator,
            },
        ])
    }

    return result
}