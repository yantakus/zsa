"use server"

import z from "zod"
import { createServerAction } from "zsa"

export async function Hello() {
  return "hello"
}

export const myServerAction = createServerAction()
  .input(
    z.object({
      message: z.string(),
    })
  )
  .handler(async ({ input }) => {
    // sleep for .5 seconds
    await new Promise((resolve) => setTimeout(resolve, 500))
    // update the message
    return {
      result: "Message: " + (input.message || "N/A"),
    }
  })

export const incrementNumberAction = createServerAction()
  .input(
    z.object({
      number: z.number(),
    })
  )
  .handler(async ({ input }) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    return input.number + 1
  })

export const getRandomNumber = createServerAction()
  .input(
    z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .refine((input) => input.min < input.max)
  )
  .handler(async ({ input, ctx }) => {
    await new Promise((r) => setTimeout(r, 1000))
    return {
      number: Math.floor(Math.random() * (input.max - input.min)) + input.min,
    }
  })

export const testAction = async (data: string) => {
  return "123"
}