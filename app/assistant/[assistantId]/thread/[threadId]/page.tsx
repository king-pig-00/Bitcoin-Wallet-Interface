'use client'

import { useCallback, useEffect, useReducer } from 'react'
import { useRouter } from 'next/navigation'
import { readStreamableValue } from 'ai/rsc'
import { createMessage, listMessages, runThread } from '@/lib/actions'
import { Message } from '@/lib/types'
import { Chat } from '@/components/chat'

interface PageProps {
  params: { assistantId: string; threadId: string }
}

type State = {
  messages: Message[]
  isLoading: boolean
}

type Action =
  | { type: 'ADD_MESSAGE'; message: Message }
  | { type: 'UPDATE_LAST_MESSAGE'; content: string }
  | { type: 'SET_LOADING'; isLoading: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] }
    case 'UPDATE_LAST_MESSAGE':
      const updatedMessages = [...state.messages]
      updatedMessages[updatedMessages.length - 1].content = action.content
      return { ...state, messages: updatedMessages }
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading }
    default:
      return state
  }
}

export default function Page({ params }: PageProps) {
  const router = useRouter()

  const [state, dispatch] = useReducer(reducer, {
    messages: [],
    isLoading: false,
  })

  const fetchMessages = useCallback(async () => {
    const messages = await listMessages(params.threadId)
    messages.forEach(message => dispatch({ type: 'ADD_MESSAGE', message }))
  }, [params.threadId])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  async function handleSubmit(input: string) {
    const userMessage: Message = {
      content: input,
      role: 'user',
    }
    dispatch({ type: 'ADD_MESSAGE', message: userMessage })
    dispatch({ type: 'SET_LOADING', isLoading: true })

    await createMessage(params.threadId, userMessage)
    const stream = await runThread(params.threadId, params.assistantId)

    dispatch({ type: 'ADD_MESSAGE', message: { role: 'assistant', content: '_Generating response..._' } })
    for await (const v of readStreamableValue(stream)) {
      if (v && v.text !== '') {
        dispatch({ type: 'UPDATE_LAST_MESSAGE', content: v.text })
      }
    }
    dispatch({ type: 'SET_LOADING', isLoading: false })
  }

  async function handleQuiz() {
    const quizRequestMessage: Message = {
      content: "Please generate a quiz for me.",
      role: 'user',
    };

    dispatch({ type: 'ADD_MESSAGE', message: quizRequestMessage });
    dispatch({ type: 'SET_LOADING', isLoading: true });

    await createMessage(params.threadId, quizRequestMessage);
    const stream = await runThread(params.threadId, params.assistantId);

    dispatch({ type: 'ADD_MESSAGE', message: { role: 'assistant', content: '_Generating quiz..._' } });
    
    let quizData = null;
    for await (const v of readStreamableValue(stream)) {
      if (v && v.text !== '') {
        dispatch({ type: 'UPDATE_LAST_MESSAGE', content: v.text });
        quizData = v.text; // Assuming the API returns quiz data in this format
      }
    }
    
    dispatch({ type: 'SET_LOADING', isLoading: false });

    // Redirect to the quiz page with quiz data
    if (quizData) {
      console.log(quizData)
      localStorage.setItem('quizData', JSON.stringify(quizData));
       router.push('/quiz');
    }
  }

  return (
    <div className="relative flex h-[calc(100vh-theme(spacing.16))] overflow-hidden bg-background dark:bg-transparent">
      <Chat messages={state.messages} handleSubmit={handleSubmit} isLoading={state.isLoading} handleQuiz={handleQuiz} />
    </div>
  )
}
