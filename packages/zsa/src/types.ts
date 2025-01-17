import { z } from "zod"
import {
  TOnCompleteFn,
  TOnErrorFn,
  TOnStartFn,
  TOnSuccessFn,
} from "./callbacks"
import { TZSAError, ZSAError } from "./errors"
import { NextRequest } from "./next-request"

/** Replace void with undefined */
type TCleanData<T extends Promise<any>> =
  Extract<Awaited<T>, void> extends never
    ? Awaited<T>
    : Exclude<Awaited<T>, void> | undefined

/** The return type of a server action */
export type TDataOrError<
  TInputSchema extends z.ZodType,
  TData extends Promise<any>,
> =
  | Promise<[TCleanData<TData>, null]>
  | Promise<[null, TZSAError<TInputSchema>]>

/** A configuration object for retrying a server action */
export interface RetryConfig {
  /** The maximum number of times to retry the action. Inclusive. */
  maxAttempts: number
  /**
   * The delay in milliseconds between each retry attempt.
   *
   * Can either be a number (ms) or a function that takes the
   * current attempt number and the error as arguments and returns a number of ms.
   *
   * NOTE: The current attempt starts at 2
   * (the first attempt errored then the current attempt becomes is 2)
   *
   * @example
   * Exponential backoff
   * ```ts
   * delay: (currentAttempt) =>
   *   Math.min(
   *     currentAttempt > 2 ? 2 ** currentAttempt * 1000 : 1000,
   *     30 * 1000
   *   ),
   * ```
   *
   * @example
   * Linear backoff
   * ```ts
   * delay: (currentAttempt) =>
   *   (currentAttempt - 1) * 1000,
   * ```
   */
  delay?: number | ((currentAttempt: number, err: ZSAError) => number)
}

export interface THandlerOpts<TProcedureChainOutput extends any> {
  /** The context of the handler */
  ctx?: TProcedureChainOutput
  /** Override the input schema */
  overrideInputSchema?: z.ZodType
  /** return the input schema */
  returnInputSchema?: boolean
  /** return the output schema */
  returnOutputSchema?: boolean
  /** an associated request object */
  request?: NextRequest
  /** the number of attempts the handler has made */
  attempts?: number
}

/** A function type for a handler that does not have an input */
export interface TNoInputHandlerFunc<
  TRet extends any,
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TProcedureChainOutput extends any,
> {
  (
    placeholder?: undefined,
    $overrideArgs?: undefined,
    $opts?: THandlerOpts<TProcedureChainOutput>
  ): TDataOrError<
    TInputSchema,
    TOutputSchema extends z.ZodUndefined ? TRet : TOutputSchema["_output"]
  >
}

/** A function type for a handler that has an input */
export interface THandlerFunc<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TRet extends any,
  TProcedureChainOutput extends any,
  TInputType extends InputTypeOptions,
> {
  (
    /** The input to the handler */
    args: TInputType extends "json" ? TInputSchema["_input"] : FormData,
    /** Override the args */
    $overrideArgs?: Partial<TInputSchema["_input"]>,
    /** Options for the handler */
    $opts?: THandlerOpts<TProcedureChainOutput>
  ): TDataOrError<
    TInputSchema,
    TOutputSchema extends z.ZodUndefined ? TRet : TOutputSchema["_output"]
  >
}

/** a helper type to hold the status of a timeout */
export interface TimeoutStatus {
  isTimeout: boolean
}

/** which keys should be default omitted from the safe zod function */
export const DefaultOmitted = {
  $internals: 1,
  handleError: 1,
  onInputParseError: 1,
  getTimeoutErrorPromise: 1,
  getProcedureChainOutput: 1,
  handleSuccess: 1,
  handleStart: 1,
  parseInputData: 1,
  parseOutputData: 1,
  onOutputParseError: 1,
  checkTimeoutStatus: 1,
  getRetryDelay: 1,
} as const

export type TZodSafeFunctionDefaultOmitted = keyof typeof DefaultOmitted

/** A combination of both a no input handler and a handler */
export type TAnyZodSafeFunctionHandler<
  TInputSchema extends z.ZodType = z.ZodType,
  TData extends Promise<any> = Promise<any>,
> =
  | ((
      input: any,
      overrideArgs?: any,
      opts?: THandlerOpts<any>
    ) => TDataOrError<TInputSchema, TData>)
  | ((
      placeholder?: undefined,
      overrideArgs?: undefined,
      opts?: THandlerOpts<any>
    ) => TDataOrError<TInputSchema, TData>)

/** infer input schema */
export type inferInputSchemaFromHandler<
  THandler extends TAnyZodSafeFunctionHandler,
> =
  THandler extends TAnyZodSafeFunctionHandler<infer TInputSchema>
    ? TInputSchema
    : z.ZodType

/**
 * A data type for the internals of a Zod Safe Function
 */
export interface TInternals<
  TInputSchema extends z.ZodType,
  TOutputSchema extends z.ZodType,
  TIsProcedure extends boolean,
> {
  /**
   *
   * A chain of handler functions to run before the main handler (if any)
   *
   * These would come from the procedure chain
   *
   */
  procedureHandlerChain: TAnyZodSafeFunctionHandler[]

  /** The final input schema of the handler */
  inputSchema: TInputSchema

  /** The final output schema of the handler */
  outputSchema: TOutputSchema

  /** A function to run when an input parse error occurs */
  onInputParseError?: ((err: z.ZodError<TInputSchema>) => any) | undefined

  /** A function to run when the output parse error occurs */
  onOutputParseError?: ((err: z.ZodError<TOutputSchema>) => any) | undefined

  /**
   * The timeout of the handler in milliseconds
   */
  timeout?: number | undefined

  /**
   * The retry configuration of the handler
   */
  retryConfig?: RetryConfig | undefined

  /** A function to run when the handler errors */
  onErrorFn?: TOnErrorFn | undefined

  /** A function to run when the handler starts */
  onStartFn?: TOnStartFn<TInputSchema, TIsProcedure> | undefined

  /** A function to run when the handler succeeds */
  onSuccessFn?:
    | TOnSuccessFn<TInputSchema, TOutputSchema, TIsProcedure>
    | undefined

  /** A function to run when the handler completes (success or error) */
  onCompleteFn?:
    | TOnCompleteFn<TInputSchema, TOutputSchema, TIsProcedure>
    | undefined

  /** The procedure function to run when an error occurs */
  onErrorFromProcedureFn?: TOnErrorFn | undefined

  /** The procedure function to run when the handler starts */
  onStartFromProcedureFn?: TOnStartFn<TInputSchema, true> | undefined

  /** The procedure function to run when the handler succeeds */
  onSuccessFromProcedureFn?:
    | TOnSuccessFn<TInputSchema, TOutputSchema, true>
    | undefined

  /** The procedure function to run when the handler completes (success or error) */
  onCompleteFromProcedureFn?:
    | TOnCompleteFn<TInputSchema, TOutputSchema, true>
    | undefined

  /** Boolean indicating if the procedure has a parent */
  isChained?: boolean | undefined

  /** Boolean indicating if the handler is a procedure */
  isProcedure?: TIsProcedure | undefined

  /** The handler function */
  handler?: TAnyZodSafeFunctionHandler | undefined
}

export type InputTypeOptions = "formData" | "json"
