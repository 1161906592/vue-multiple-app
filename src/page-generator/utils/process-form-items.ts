import { IFormItem, IService } from "../@types";

const { makeCamelCase } = require("../utils")

interface IProcessFormItemsProps {
    formItems?: IFormItem[]
    hooks: string[]
    services: IService[]
}

const processFormItems = ({ formItems, hooks, services  }: IProcessFormItemsProps) => {
    if (!formItems) {
        return
    }

    // 处理下拉框
    formItems.filter(d => d.type === "select").forEach((item) => {
        const dep = item.dep && `query.${item.dep}`
        if (dep) {
            item.disabled = ` :disabled="!${dep}"`
        }
        hooks.push(
            `useSelectOptions({
    namespace: "${item.prop}",
    options: [${item.options ? "\n      " : ""}${item.options
                ?.map(({value, label}) => `{ value: "${value}", label: "${label}" }`)
                .join(",\n      ") || ""}${item.options ? "\n    " : ""}]${item.api ? `,
    async getOptions() {
      const { status, data, message } = await ${makeCamelCase("get", item.prop, "options")}()
      if (status) {
        this.${item.prop}Options = data
      } else {
        this.$message.error(message)
      }
    }` : ""}${dep ? `,\n    dep: "${dep}"` : ""}
  })`
        )
        if (item.api) {
            services.push({
                method: "get",
                name: makeCamelCase("get", item.prop, "options"),
                api: item.api
            })
        }
    })
}

export default processFormItems
