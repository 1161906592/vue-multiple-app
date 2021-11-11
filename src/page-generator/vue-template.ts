import {IComponentConfig, IComponentEnum, IInjectParent} from "./@types";
import {templateMap} from "./index";

import { injectTemplate, camelCaseToShortLine, firstToUpperCase } from "./utils"

const baseTemplate =
`<template>
  <%template%>
</template>

<script>
import pipe from "@/utils/pipe";
<%utilImports%>
<%componentImports%>
<%serviceImports%>

export default pipe(
  <%hooks%>
)({
  name: "<%name%>",
})
</script>

<style lang="scss" scoped></style>
`

const utilImportsTemplate =
`import {
  <%imports%>
} from "@/utils"`

const serviceImportsTemplate =
`import {
  <%imports%>
} from "<%servicePath%>"`

const componentImportsTemplate = `import <%name%> from "<%componentPath%><%name%>"`

export const componentsTemplate = `<<%component%><%props%>/>`

const vueTemplate =  (config: IComponentConfig, type: IComponentEnum) => {
    const { components } = config
    const {
        name,
        template,
        hooks = [],
        components: privateComponents,
        services
    } = templateMap.get(config.templateId)!.processTemplate(config, type)

    const realName = firstToUpperCase(name)

    const mergedComponents = [...(privateComponents || []), ...(components || [])]
    // if (type !== IComponentEnum.page) {
    //     // 给组件内的组件添加命名空间
    //     mergedComponents.forEach((item) => {
    //         item.name = `${realName}${firstToUpperCase(item.name)}`
    //     })
    // }

    const injectParents = mergedComponents
        .map((item) => templateMap.get(item.templateId)!.injectParent(item))

    injectParents?.forEach(({ hooks: injectHooks }) => {
        injectHooks.forEach(item => {
            hooks.push(item)
        })
    })

    const componentNames = Array.from(new Set(mergedComponents.map(d => d.name)))
    if (mergedComponents.length) {
        hooks.unshift(`useComponents({
    ${componentNames.join(",\n    ")}
  })`)
    }

    const utilImports = new Set(hooks?.map((d: string) => d.match(/\w+/)![0]) || [])

    return {
        template: injectTemplate(injectTemplate(baseTemplate, {
            template,
            name: realName,
            utilImports: utilImports.size ? injectTemplate(utilImportsTemplate, {
                imports: Array.from(utilImports).join(",\n  ")
            }) : " ",
            componentImports: componentNames.map(name => injectTemplate(componentImportsTemplate, {
                name,
                componentPath: type === IComponentEnum.page ? "./components/" : "./"
            })).join("\n") || " ",
            serviceImports: services?.length ? injectTemplate(serviceImportsTemplate, {
                imports: services.map((d: any) => d.name).join(",\n  "),
                servicePath: type === IComponentEnum.page ? "./services" : `../services/${camelCaseToShortLine(realName)}`,
            }) : " ",
            hooks: hooks?.join(",\n  ") || " ",
        }), {
            components: mergedComponents.map((item, index) => {
                const props = injectParents[index].props || []
                return injectTemplate(componentsTemplate, {
                    component: camelCaseToShortLine(item.name),
                    props: props.length ?` ${injectParents[index].props?.join(" ")} ` : " "
                }, 4)
            }) .join("\n    ")|| " "
        }),
        components: mergedComponents,
        services
    }
}

export default vueTemplate
