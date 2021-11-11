import { injectTemplate } from "../../utils"
import processFormItems from "../../utils/process-form-items"
import {
    IConfigurator,
    IFormItem,
    IInjectParent,
    IProcessTemplate,
    IService,
} from "../../@types";
import inquirer from "inquirer";
import basePrompt from "../../utils/base-prompt";
import tipsSplit from "../../utils/tips-split";
import { propValidator, requiredValidator } from "../../utils/validators";
import { promptSelectOptions } from "../table";
import { judgeType } from "../../utils";

export const templateId = "dialog-form"

export const componentOnly = true

const template = `
<el-dialog :visible.sync="visible" :title="title" @close="$emit('update:visible', false)" width="<%width%>px" append-to-body :close-on-click-modal="false">
  <el-form :model="form" size="small" :rules="formRules" ref="form" label-suffix="：">
     <%formItems%>
  </el-form>
  <template #footer>
    <el-button size="small" @click="$emit('update:visible', false)">取消</el-button>
    <el-button size="small" type="primary" :loading="formLoading" @click="handleSubmit">确定</el-button>
  </template>
  <%components%>
</el-dialog>
`

const inputItemTemp = `
<el-form-item label="<%label%>" prop="<%prop%>" label-width="<%labelWidth%>px"  >
  <el-input v-model="form.<%prop%>" maxlength="<%maxlength%>" />
</el-form-item>`

const selectItemTemp = `
<el-form-item label="<%label%>" prop="<%prop%>" label-width="<%labelWidth%>px">
  <el-select clearable v-model="form.<%prop%>" style="width: 100%;">
    <el-option v-for="{ label, value } in <%prop%>Options" :key="value" :label="label" :value="value"  />
  </el-select>
</el-form-item>`

const radioItemTemp = `
<el-form-item label="<%label%>" prop="<%prop%>" label-width="<%labelWidth%>px">
    <el-radio-group v-model="form.<%prop%>">
        <el-radio v-for="{ label, value } in <%prop%>Options" :key="value" :label="value">{{label}}</el-radio>
    </el-radio-group>
</el-form-item>
`

interface IDialogFormOptions {
    formItems: (IFormItem & {
        required: boolean
    })[]
    title: string
    width: number
    api: string
}

export const processTemplate: IProcessTemplate<IDialogFormOptions> = ({ name, options }) => {
    const { formItems, width = 440, api } = options

    const requiredItems = formItems?.filter((d) => d.required) || []

    const hooks = [
        `useModal({
    onShow() {},
    formRules: {${requiredItems.length ? `\n      ${requiredItems.map(d => `${d.prop}: { required: true, message: "请输入${d.label}", trigger: ["change", "blur"] }`)
            .join(",\n      ")}\n    ` : ""}},
    async doSubmit() {
      const { status, message } = await doSubmit(this.form)
      if (status) {
        this.$message.error("操作成功")
        this.$emit("update:visible", false)
      } else {
        this.$message.error(message)
      }
    }
  })`
    ]
    const services: IService[] = [
        {
            name: "doSubmit",
            method: "post",
            api
        }
    ]

    processFormItems({ formItems, hooks, services, depForm: "form" })

    return {
        name,
        template: injectTemplate(template, ({
            formItems: formItems?.map((item) => {
                if (item.type === "input") {
                    return injectTemplate(inputItemTemp, {
                        labelWidth: 120,
                        ...item
                    }, 4)
                }
                if (item.type === "select") {
                    return injectTemplate(selectItemTemp, {
                        labelWidth: 120,
                        ...item
                    }, 4)
                }
                if (item.type == "radio") {
                    return injectTemplate(radioItemTemp, {
                        labelWidth: 120,
                        ...item
                    }, 4)
                }
            }).join("\n") || " ",
            width,
        }), 2),
        hooks,
        components: [],
        services
    }
}

export const injectParent: IInjectParent<IDialogFormOptions> = (config) => {
    const hooks = [
        `useModalCtrl({ name: "${config.namespace}", title: "${config.options.title}" })`
    ]

    const props = [
        `:visible.sync="${config.namespace}Visible"`,
        `:data="${config.namespace}Data"`,
        `:title="${config.namespace}Title"`
    ]

    return {
        hooks,
        props,
    }
}

export const configurator: IConfigurator<IDialogFormOptions> = async () => {
    const result = await basePrompt<IDialogFormOptions>({
        templateId: "dialog-form",
    })

    const { title, width, formItems } = await inquirer.prompt([
        {
            type: "input",
            message: "标题:",
            name: "title"
        },
        {
            type: "number",
            message: "宽度:",
            name: "width"
        },
        {
            type: "number",
            message: "表单项数量:",
            name: "formItems"
        },
    ])

    const options = {} as IDialogFormOptions

    result.options = options
    options.title = title
    options.width = width
    options.formItems = await promptFormItems({ length: formItems, required: true })

    options.api = (await inquirer.prompt([
        {
            type: "input",
            message: "提交接口:",
            name: "api"
        },
    ])).api

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
                choices: ["input", "select", "radio"],
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
            {
                type: "confirm",
                message: `是否必填:`,
                name: `required`,
                default: true,
                when: () => required
            },
            {
                type: "list",
                message: `数据源类型:`,
                name: "source",
                choices: ["接口", "固定项"],
                when: (answer: any) => judgeType(answer.type)
            },
            {
                type: "input",
                message: `数据源接口api:`,
                name: "api",
                when: (answer: any) => judgeType(answer.type) && answer.source === "接口",
                validate: requiredValidator
            },
            {
                type: "checkbox",
                message: `数据源依赖表单项prop:`,
                name: "deps",
                when: (answer: any) => judgeType(answer.type) && answer.source === "接口",
                choices: result.map(d => d.prop)
            },
            {
                type: "number",
                message: `固定项个数:`,
                name: "count",
                default: 2,
                when: (answer: any) => judgeType(answer.type) && answer.source === "固定项"
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
