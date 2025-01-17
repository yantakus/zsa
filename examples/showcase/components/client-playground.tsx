"use client"

import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/lib/hooks/server-action-hooks"
import { generateRandomNumber, searchContacts } from "@/server/actions"
import { useDebounce } from "@uidotdev/usehooks"
import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"
import { Input } from "./ui/input"
import { Skeleton } from "./ui/skeleton"

export default function ClientPlayground() {
  const [input, setInput] = useState("")
  const debouncedInput = useDebounce(input, 300)

  const queryAction = useServerActionQuery(searchContacts, {
    input: {
      query: debouncedInput,
    },
    enabled: Boolean(debouncedInput),
    queryKey: ["getPosts"],
  })
  const { mutateAsync, data: mutateData } = useServerActionMutation(
    generateRandomNumber,
    {
      mutationKey: ["generateRandomNumber"],
      returnError: true,
    }
  )

  let contactsView

  if (queryAction.data) {
    contactsView = (
      <div>
        {queryAction.data.map((c) => (
          <div key={c.id}>{c.name}</div>
        ))}
      </div>
    )
  } else if (queryAction.isLoading) {
    contactsView = <Skeleton />
  } else if (queryAction.isError) {
    contactsView = (
      <div className="text-red-500">
        Error: {JSON.stringify(queryAction.error)}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call From Client Component</CardTitle>
        <CardDescription>
          This card fetches data from a client component
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Input
          placeholder="Search contacts..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <h1>Search Results</h1>
        {contactsView}
        <button
          onClick={async () => {
            await mutateAsync({ min: 1, max: 100 })
          }}
        ></button>
        {JSON.stringify(mutateData)}
      </CardContent>
    </Card>
  )
}
