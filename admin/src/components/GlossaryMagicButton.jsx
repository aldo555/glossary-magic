import { useState} from 'react'
import { Button } from '@strapi/design-system'
import { Magic, Link, Trash } from '@strapi/icons'
import { unstable_useContentManagerContext as useContentManagerContext } from '@strapi/strapi/admin'
import { useNotification } from '@strapi/strapi/admin';
import { useFetchClient } from '@strapi/admin/strapi-admin'
import {PLUGIN_ID} from "../pluginId"
import pluralize from 'pluralize';

export const GlossaryMagicButton = ({ document }) => {
  const {
    model,
    form,
  } = useContentManagerContext()

  if (model !== 'api::article.article') {
    return null
  }

  const { values } = form

  const { get, post } = useFetchClient()
  const { toggleNotification } = useNotification()
  const [magicLoading, setMagicLoading] = useState(false)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)

  const handleMagicClick = async () => {
    try {
      setMagicLoading(true)
      const response = await get(`/${PLUGIN_ID}/get-glossary-words?article=${document.documentId}`)
      const usedWords = addGlossaryLinks(response.data)

      const usedWordsString = usedWords.join(', ')

      if (usedWords.length === 0) {
        toggleNotification({
          title: 'The magic has been successfully cast!',
          timeout: 1000 * 5,
          type: 'success',
          message: 'No glossary words were found in the article or they were already added.',
        });

        setMagicLoading(false)
        return
      }

      toggleNotification({
        title: 'The magic has been successfully cast! Make sure to save those changes!',
        timeout: 1000 * 60 * 60,
        type: 'success',
        message: `The following ${usedWords.length} words have been added: ${usedWordsString}.`,
      });
      toggleNotification({
        title: 'Don\'t forget!',
        timeout: 1000 * 60,
        type: 'warning',
        message: 'You should connect the words to the article by clicking the "Connect Used Words to Article" button below.',
      })
      setMagicLoading(false)
    } catch (error) {
      toggleNotification({
        title: 'The spell failed!',
        type: 'danger',
        message: 'Please try again later.',
      })
      setMagicLoading(false)
    }
  }

  const addGlossaryLinks = (glossaryWords) => {
    const usedWords = []

    const contentFields = [
      { name: 'contentLead', value: values.contentLead },
      { name: 'contentTop', value: values.contentTop },
      { name: 'contentMiddle', value: values.contentMiddle },
      { name: 'contentBottom', value: values.contentBottom },
    ]

    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    glossaryWords.forEach((glossaryWord) => {
      const word = glossaryWord.word

      const escapedWord = escapeRegExp(word)
      const singularForm = pluralize.singular(word)
      const pluralForm = pluralize.plural(word)

      const escapedSingular = escapeRegExp(singularForm)
      const escapedPlural = escapeRegExp(pluralForm)

      const wordPattern = `${escapedWord}|${escapedSingular}|${escapedPlural}`
      const wordRegex = new RegExp(`\\b(${wordPattern})\\b`, 'i')

      const linkRegex = new RegExp(`\\[\\s*(${wordPattern})\\s*\\]\\([^\\)]+\\)`, 'i')

      let wordAlreadyLinked = false
      for (let i = 0; i < contentFields.length; i++) {
        const { value } = contentFields[i]
        if (linkRegex.test(value)) {
          wordAlreadyLinked = true
          break
        }
      }

      if (wordAlreadyLinked) {
        return
      }

      let wordReplaced = false

      for (let i = 0; i < contentFields.length; i++) {
        const field = contentFields[i]
        const { name, value } = field

        if (wordRegex.test(value)) {
          const newValue = value.replace(wordRegex, (match) => `[${match}](${glossaryWord.link})`)

          form.onChange({ target: { name: name, value: newValue } })

          wordReplaced = true

          usedWords.push(word)

          break
        }
      }
    })

    return usedWords
  }

  const handleConnectClick = async () => {
    try {
      setConnectLoading(true)
      const wordsResponse = await get(`/${PLUGIN_ID}/get-glossary-words?article=${document.documentId}`)
      const wordsToConnect = findUsedGlossaryWords(wordsResponse.data)

      const usedWordsString = wordsToConnect.map((word) => word.word).join(', ')

      if (wordsToConnect.length === 0) {
        toggleNotification({
          title: 'Connection successful!',
          timeout: 1000 * 5,
          type: 'success',
          message: 'No glossary words were found in the article.',
        });

        setConnectLoading(false)
        return
      }

      await post(`/${PLUGIN_ID}/connect-glossary-words`, {
        article: document.documentId,
        allWords: wordsResponse.data.map((word) => word.documentId),
        wordsToConnect: wordsToConnect.map((word) => word.documentId),
      })

      toggleNotification({
        title: 'Connection successful!',
        timeout: 1000 * 60 * 60,
        type: 'success',
        message: `The following ${wordsToConnect.length} words have been connected to the article: ${usedWordsString}.`,
      });
      setConnectLoading(false)
    } catch (error) {
      toggleNotification({
        title: 'Connection failed!',
        type: 'danger',
        message: 'Please try again later.',
      })
      setConnectLoading(false)
    }
  }

  const findUsedGlossaryWords = (glossaryWords) => {
    const usedWords = []

    const contentFields = [
      { name: 'contentLead', value: values.contentLead },
      { name: 'contentTop', value: values.contentTop },
      { name: 'contentMiddle', value: values.contentMiddle },
      { name: 'contentBottom', value: values.contentBottom },
    ]

    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    glossaryWords.forEach((glossaryWord) => {
      const word = glossaryWord.word

      const escapedWord = escapeRegExp(word)
      const singularForm = pluralize.singular(word)
      const pluralForm = pluralize.plural(word)

      const escapedSingular = escapeRegExp(singularForm)
      const escapedPlural = escapeRegExp(pluralForm)

      const wordPattern = `${escapedWord}|${escapedSingular}|${escapedPlural}`

      const linkRegex = new RegExp(`\\[\\s*(${wordPattern})\\s*\\]\\([^\\)]+\\)`, 'i')

      let wordAlreadyLinked = false
      for (let i = 0; i < contentFields.length; i++) {
        const { value } = contentFields[i]
        if (linkRegex.test(value)) {
          wordAlreadyLinked = true
          break
        }
      }

      if (wordAlreadyLinked) {
        usedWords.push(glossaryWord)
      }
    })

    return usedWords
  }

  const handleDisconnectClick = async () => {
    try {
      setDisconnectLoading(true)

      await post(`/${PLUGIN_ID}/disconnect-glossary-words`, {
        article: document.documentId,
      })

      toggleNotification({
        title: 'Disconnection successful!',
        timeout: 1000 * 60 * 60,
        type: 'success',
        message: `All glossary words have been disconnected from the article.`,
      });
      setDisconnectLoading(false)
    } catch (error) {
      toggleNotification({
        title: 'Disconnection failed!',
        type: 'danger',
        message: 'Please try again later.',
      })
      setDisconnectLoading(false)
    }
  }

  return {
    title: 'Glossary',
    content: (
      <>
        <Button
          variant="secondary"
          fullWidth
          disabled={magicLoading}
          startIcon={<Magic />}
          onClick={handleMagicClick}
        >
          {magicLoading ? 'Casting Magic...' : 'Cast Glossary Magic'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={connectLoading}
          startIcon={<Link />}
          onClick={handleConnectClick}
        >
          {connectLoading ? 'Connecting words...' : 'Connect Used Words to Article'}
        </Button>
        <Button
          variant="secondary"
          fullWidth
          disabled={disconnectLoading}
          startIcon={<Trash />}
          onClick={handleDisconnectClick}
        >
          {disconnectLoading ? 'Disconnecting words...' : 'Disonnect All Words from Article'}
        </Button>
      </>
    ),
  }
}
