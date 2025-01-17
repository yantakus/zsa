import { type NextRequest } from "next/server"
import { OpenAPIV3 } from "openapi-types"
import { pathToRegexp } from "path-to-regexp"
import { TAnyZodSafeFunctionHandler, TZSAError } from "zsa"
import {
  acceptsRequestBody,
  getErrorStatusFromZSAError,
  preparePathForMatching,
} from "./utils"

export type OpenApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

const FORM_DATA_CONTENT_TYPE = "application/x-www-form-urlencoded"
const MULTI_PART_CONTENT_TYPE = "multipart/form-data"
const JSON_CONTENT_TYPE = "application/json"

export type OpenApiContentType =
  | typeof FORM_DATA_CONTENT_TYPE
  | typeof JSON_CONTENT_TYPE
  | typeof MULTI_PART_CONTENT_TYPE
  | (string & {})

export interface ApiRouteHandler<TRet> {
  (request: NextRequest): Promise<TRet>
}

/**
 * Store OpenAPI information alongside a server action
 */
export interface OpenApiAction<THandler extends TAnyZodSafeFunctionHandler> {
  enabled?: boolean
  method: OpenApiMethod
  path: string
  summary?: string
  description?: string
  protect?: boolean
  tags?: string[]
  headers?: (OpenAPIV3.ParameterBaseObject & { name: string; in?: "header" })[]
  contentTypes?: OpenApiContentType[]
  deprecated?: boolean
  example?: {
    request?: Record<string, any>
    response?: Record<string, any>
  }
  responseHeaders?: Record<
    string,
    OpenAPIV3.HeaderObject | OpenAPIV3.ReferenceObject
  >
  action: THandler
}

type TOpenApiSpecs = Omit<OpenApiAction<any>, "path" | "action" | "method">

const standardizePath = (path: string, method: string) => {
  return path.replace(/\{[^}]+\}/g, "{param}") + `<${method}>`
}

/**
 *  Helper function to create a path safely
 */
const createPath = (args: {
  path: string
  method: OpenApiMethod
  pathPrefix?: string | undefined
  actions: OpenApiAction<any>[]
}) => {
  const { path, method, pathPrefix, actions } = args

  const tmp = pathPrefix ? `${pathPrefix}${path}` : path
  if (tmp.endsWith("/") && tmp !== "/") {
    return tmp.slice(0, -1)
  }

  if (tmp.includes(" ")) {
    throw new Error(`Path [${method}]: ${tmp} contains a space`)
  }

  if (tmp.includes("?")) {
    throw new Error(
      `Path [${method}]: ${tmp} contains a question mark. Do not include query params in the path`
    )
  }

  // check for duplicates
  for (const action of actions) {
    // regex replace all {param} with {param}
    const tmpClean = standardizePath(tmp, method)
    const actionPathClean = standardizePath(action.path, action.method)

    if (tmpClean === actionPathClean) {
      throw new Error(`Duplicate path [${method}]: ${tmp} and ${action.path}`)
    }
  }

  return tmp
}

class OpenApiServerActionRouter {
  $INTERNALS: {
    pathPrefix?: string | undefined
    actions: OpenApiAction<any>[]
    defaults?: TOpenApiSpecs
  }

  constructor(opts?: {
    pathPrefix?: string
    actions?: OpenApiAction<any>[]
    defaults?: TOpenApiSpecs
  }) {
    let pathPrefix = opts?.pathPrefix

    if (pathPrefix?.endsWith("/") && pathPrefix !== "/") {
      // make sure the path prefix doesn't end with a slash
      pathPrefix = pathPrefix.slice(0, -1)
    } else if (pathPrefix === "/") {
      // make sure it isn't just a slash
      pathPrefix = ""
    }

    if (opts?.actions) {
      const seen = new Set<string>()
      for (const action of opts.actions) {
        const p = standardizePath(action.path, action.method)
        if (seen.has(p)) {
          throw new Error(`Duplicate path [${action.method}]: ${p}`)
        }
        seen.add(p)
      }
    }

    this.$INTERNALS = {
      pathPrefix,
      actions: opts?.actions || [],
      defaults: opts?.defaults,
    }
  }

  /**
   * Add a server action to the router as a GET route
   *
   * @example
   * ```ts
   * router.get("/posts", getPostsAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  get<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    this.$INTERNALS.actions.push({
      ...(this.$INTERNALS.defaults || {}),
      ...args,
      method: "GET",
      path: createPath({
        path,
        method: "GET",
        actions: this.$INTERNALS.actions,
        pathPrefix: this.$INTERNALS.pathPrefix,
      }),
      action,
    })
    return this
  }

  /**
   * Add a server action to the router as a POST route
   *
   * @example
   * ```ts
   * router.post("/posts", createPostAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  post<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    this.$INTERNALS.actions.push({
      ...(this.$INTERNALS.defaults || {}),
      ...args,
      method: "POST",
      path: createPath({
        path,
        method: "POST",
        actions: this.$INTERNALS.actions,
        pathPrefix: this.$INTERNALS.pathPrefix,
      }),
      action,
    })
    return this
  }

  /**
   * Add a server action to the router as a DELETE route
   *
   * @example
   * ```ts
   * router.delete("/posts/{postId}", deletePostAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  delete<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    this.$INTERNALS.actions.push({
      ...(this.$INTERNALS.defaults || {}),
      ...args,
      method: "DELETE",
      path: createPath({
        path,
        method: "DELETE",
        actions: this.$INTERNALS.actions,
        pathPrefix: this.$INTERNALS.pathPrefix,
      }),
      action,
    })
    return this
  }

  /**
   * Add a server action to the router as a PUT route
   *
   * @example
   * ```ts
   * router.put("/posts/{postId}", updatePostAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  put<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    this.$INTERNALS.actions.push({
      ...(this.$INTERNALS.defaults || {}),
      ...args,
      method: "PUT",
      path: createPath({
        path,
        method: "PUT",
        actions: this.$INTERNALS.actions,
        pathPrefix: this.$INTERNALS.pathPrefix,
      }),
      action,
    })
    return this
  }

  /**
   * Add a server action to the router as a PATCH route
   *
   * @example
   * ```ts
   * router.patch("/posts/{postId}", updatePostAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  patch<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    this.$INTERNALS.actions.push({
      ...(this.$INTERNALS.defaults || {}),
      ...args,
      method: "PATCH",
      path: createPath({
        path,
        method: "PATCH",
        actions: this.$INTERNALS.actions,
        pathPrefix: this.$INTERNALS.pathPrefix,
      }),
      action,
    })
    return this
  }

  /**
   * Add all server actions to the router as GET, POST, DELETE, PUT, and PATCH routes
   *
   * @example
   * ```ts
   * router.all("/posts", createPostAction, {
   *   tags: ["posts"],
   * })
   * ```
   */
  all<THandler extends TAnyZodSafeFunctionHandler>(
    path: `/${string}`,
    action: THandler,
    args?: TOpenApiSpecs
  ) {
    for (const func of [
      this.get,
      this.post,
      this.delete,
      this.put,
      this.patch,
    ]) {
      func.call(this, path, action, args)
    }
    return this
  }
}

export type TOpenApiServerActionRouter = OpenApiServerActionRouter

/**
 * Create a router and add server actions to it
 *
 * @example
 * ```ts
 * const router = createOpenApiServerActionRouter()
 *   .get("/posts", getPostsAction)
 *   .post("/posts", createPostAction)
 *   .delete("/posts/{postId}", deletePostAction)
 *   .put("/posts/{postId}", updatePostAction)
 *   .patch("/posts/{postId}", updatePostAction)
 * ```
 */
export const createOpenApiServerActionRouter = (args?: {
  /**
   * The path prefix for the router
   *
   * @example
   * ```tsx
   * const router = createOpenApiServerActionRouter({ pathPrefix: "/api" })
   *   .get("/posts", getPostsAction)
   * ```
   *
   * This will match the path `/api/posts`
   */
  pathPrefix?: `/${string}`
  /**
   * Add default OpenAPI specs to all actions
   */
  defaults?: TOpenApiSpecs
  /**
   * Extend the router with other routers
   */
  extend?: OpenApiServerActionRouter | Array<OpenApiServerActionRouter>
}): OpenApiServerActionRouter => {
  let actions: OpenApiAction<any>[] = []

  if (args && args.extend) {
    let extend: Array<OpenApiServerActionRouter> = Array.isArray(args.extend)
      ? args.extend
      : [args.extend]
    for (const router of extend) {
      for (const action of router.$INTERNALS.actions) {
        actions.push(action)
      }
    }
  }

  return new OpenApiServerActionRouter({
    ...args,
    actions,
  })
}

/**
 * Setup API route handlers for Next JS given an OpenAPI server action router
 *
 * @example
 * ```ts
 * const router = createOpenApiServerActionRouter()
 *   .get("/posts", getPostsAction)
 *   .post("/posts", createPostAction)
 *   .delete("/posts/{postId}", deletePostAction)
 *   .put("/posts/{postId}", updatePostAction)
 *   .patch("/posts/{postId}", updatePostAction)
 * export const { GET, POST, PUT, DELETE, PATCH } = createRouteHandlers(router)
 * ```
 */
export const createRouteHandlers = <
  TRet extends "Response" | "JSON" = "Response",
>(
  router: TOpenApiServerActionRouter,
  opts?: {
    responseType?: TRet
  }
) => {
  const parseRequest = async (
    request: NextRequest
  ): Promise<null | {
    input: Record<string, any> | undefined
    params: Record<string, string>
    searchParams: Record<string, string>
    action: TAnyZodSafeFunctionHandler
    body: Record<string, any> | undefined
  }> => {
    try {
      // get the search params
      const searchParams = request.nextUrl.searchParams
      const searchParamsJson =
        searchParams && "entries" in searchParams
          ? Object.fromEntries(searchParams.entries())
          : {}

      const headers = new Headers(request.headers)
      let data: Object | undefined = undefined

      // if it has a body
      if (acceptsRequestBody(request.method)) {
        try {
          if (
            headers.get("content-type")?.startsWith(FORM_DATA_CONTENT_TYPE) ||
            headers.get("content-type")?.startsWith(MULTI_PART_CONTENT_TYPE)
          ) {
            // if its form data
            const formData = await request.formData()
            data = Object.fromEntries(formData.entries())
          } else {
            // if its json
            data = await request.json()
          }
        } catch (err) {
          data = undefined
        }
      }

      const params: Record<string, string> = {}

      // find the matching action from the router
      const foundMatch = router.$INTERNALS.actions.find((action) => {
        if (action.method !== request.method) {
          return false
        }

        if (action.path === request.nextUrl.pathname) {
          return true
        }

        if (!action.path.includes("{") || !action.path.includes("}"))
          return false

        const re = pathToRegexp(preparePathForMatching(action.path))
        const match = re.exec(
          request.nextUrl.pathname.split("?")[0] || "NEVER_MATCH"
        )

        if (!match) return false

        return true
      })

      // parse the params from the path
      if (foundMatch && foundMatch.path.includes("{")) {
        let basePathSplit = (foundMatch.path as string).split("/")
        let pathSplit = (
          request.nextUrl.pathname.split("?")[0] || "NEVER_MATCH"
        ).split("/")

        if (basePathSplit.length !== pathSplit.length) {
          return {} as any
        }

        // copy over the params
        for (let i = 0; i < basePathSplit.length; i++) {
          const basePathPart = basePathSplit[i]
          const pathPart = pathSplit[i]

          if (!basePathPart || !pathPart) {
            continue
          }

          if (basePathPart.startsWith("{") && basePathPart.endsWith("}")) {
            const foundPathPartName = basePathPart.slice(1, -1)
            params[foundPathPartName] = pathPart
          }
        }
      }

      // form the final input to be sent to the action
      const final = {
        ...searchParamsJson,
        ...(data || {}),
        ...params,
      }

      if (!foundMatch) {
        return null
      }

      if (Object.keys(final).length === 0) {
        return {
          input: undefined,
          params: {},
          searchParams: {},
          action: foundMatch.action,
          body: undefined,
        }
      }

      return {
        input: final,
        params,
        searchParams: searchParamsJson,
        action: foundMatch.action,
        body: data,
      }
    } catch (error: unknown) {
      return null
    }
  }

  type TResult =
    | {
        isError: false
        isSuccess: true
        data: unknown
        status: 200
        error: null
      }
    | {
        isError: true
        isSuccess: false
        status: number
        data: null
        error: TZSAError<any>
      }

  type THandlerRet = TRet extends "Response" ? Response : TResult

  const handler: ApiRouteHandler<THandlerRet> = async (
    request: NextRequest
  ): Promise<THandlerRet> => {
    const parsedData = await parseRequest(request)
    if (!parsedData) return new Response("", { status: 404 }) as THandlerRet

    try {
      const [data, err] = await parsedData.action(parsedData.input, undefined, {
        request: request,
      })

      if (err) {
        throw err
      }

      if (opts?.responseType === "JSON") {
        return {
          isError: false,
          isSuccess: true,
          status: 200,
          data,
          error: null,
        } as THandlerRet
      }

      return new Response(JSON.stringify(data), { status: 200 }) as THandlerRet
    } catch (error: unknown) {
      let status = getErrorStatusFromZSAError(error)

      if (opts?.responseType === "JSON") {
        return {
          isError: true,
          isSuccess: false,
          status,
          data: null,
          error,
        } as THandlerRet
      }

      return new Response(JSON.stringify(error), { status }) as THandlerRet
    }
  }

  return {
    GET: handler,
    POST: handler,
    DELETE: handler,
    PUT: handler,
    PATCH: handler,
  }
}

/**
 * Create an API route handler for Next JS given a server action
 *
 * Exports `GET`, `POST`, `PUT`, `DELETE`, and `PATCH` functions.
 *
 * @example
 * ```ts
 * export const { GET } = setupApiHandler("/posts", getPostsAction)
 * ```
 *
 * @example
 * ```ts
 * export const { POST } = setupApiHandler("/posts", createPostAction)
 * ```
 *
 * @example
 * ```ts
 * export const { PUT } = setupApiHandler("/posts/{postId}", updatePostAction)
 * ```
 */
export function setupApiHandler<
  THandler extends TAnyZodSafeFunctionHandler,
  TResponseType extends "Response" | "JSON" = "Response",
>(
  path: `/${string}`,
  action: THandler,
  opts?: {
    responseType?: TResponseType
  }
) {
  const router = createOpenApiServerActionRouter()
    .get(path, action)
    .post(path, action)
    .delete(path, action)
    .put(path, action)
    .patch(path, action)

  return createRouteHandlers(router, opts)
}
