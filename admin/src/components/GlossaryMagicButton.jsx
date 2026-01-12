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

    // Sort glossary words by length (longest first) to prioritize multi-word terms
    const sortedWords = [...glossaryWords].sort((a, b) => b.word.length - a.word.length)

    // Mutable copies of content
    let contentTop = values.contentTop || ''
    let contentMiddle = values.contentMiddle || ''
    let contentBottom = values.contentBottom || ''

    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // Normalize subscript characters to regular digits
    const normalizeSubscripts = (string) => {
      const subscriptMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
      return string.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, char => subscriptMap[char] || char)
    }

    // Handle "(s)" optional plural notation - returns array of variants
    const expandOptionalPlural = (word) => {
      if (word.endsWith('(s)')) {
        const base = word.slice(0, -3) // Remove "(s)"
        return [base, base + 's']
      }
      return [word]
    }

    // Strip markdown formatting (bold, italic, code, strikethrough)
    const stripMarkdownFormatting = (text) => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '$1')  // bold **text**
        .replace(/__(.+?)__/g, '$1')       // bold __text__
        .replace(/\*(.+?)\*/g, '$1')       // italic *text*
        .replace(/_(.+?)_/g, '$1')         // italic _text_
        .replace(/~~(.+?)~~/g, '$1')       // strikethrough
        .replace(/`(.+?)`/g, '$1')         // inline code
    }

    // Helper to check if a position is inside a markdown link
    const isInsideMarkdownLink = (text, matchIndex, matchLength) => {
      const linkPattern = /\[([^\]]+)\]\([^)]+\)/g
      let match
      while ((match = linkPattern.exec(text)) !== null) {
        const linkStart = match.index
        const linkEnd = linkStart + match[0].length
        // Check if our match overlaps with this link
        if (matchIndex < linkEnd && matchIndex + matchLength > linkStart) {
          return true
        }
      }
      return false
    }

    // Helper to replace first occurrence NOT inside a link
    const replaceFirstNotInLink = (text, wordRegex, replacement) => {
      let result = text
      let match
      const globalRegex = new RegExp(wordRegex.source, 'gi')

      while ((match = globalRegex.exec(text)) !== null) {
        if (!isInsideMarkdownLink(text, match.index, match[0].length)) {
          // Replace this occurrence
          result = text.slice(0, match.index) + replacement(match[0]) + text.slice(match.index + match[0].length)
          return { replaced: true, result }
        }
      }
      return { replaced: false, result }
    }

    sortedWords.forEach((glossaryWord) => {
      const word = glossaryWord.word

      // Expand "(s)" notation to both singular and plural variants
      const wordVariants = expandOptionalPlural(word)

      // Build patterns from all variants
      const patterns = new Set()
      for (const variant of wordVariants) {
        const normalizedWord = normalizeSubscripts(variant)
        patterns.add(escapeRegExp(variant))
        patterns.add(escapeRegExp(normalizedWord))
        patterns.add(escapeRegExp(pluralize.singular(normalizedWord)))
        patterns.add(escapeRegExp(pluralize.plural(normalizedWord)))
      }

      const wordPattern = Array.from(patterns).join('|')
      const wordRegex = new RegExp(`\\b(${wordPattern})\\b`, 'i')

      // Check if this exact word is already linked (link text matches the word completely)
      const linkContentPattern = /\[([^\]]+)\]\([^)]+\)/gi
      const allContent = contentTop + contentMiddle + contentBottom
      let wordAlreadyLinked = false
      let linkMatch
      // Create a regex that matches the FULL link text (not partial)
      const fullMatchRegex = new RegExp(`^(${wordPattern})$`, 'i')
      while ((linkMatch = linkContentPattern.exec(allContent)) !== null) {
        // Strip markdown formatting from link text before matching
        const linkText = stripMarkdownFormatting(linkMatch[1].trim())
        if (fullMatchRegex.test(linkText)) {
          wordAlreadyLinked = true
          break
        }
      }

      if (wordAlreadyLinked) {
        return
      }

      // Try to replace in each field, using updated content
      const fields = [
        { name: 'contentTop', content: contentTop },
        { name: 'contentMiddle', content: contentMiddle },
        { name: 'contentBottom', content: contentBottom },
      ]

      for (const field of fields) {
        const { replaced, result } = replaceFirstNotInLink(
          field.content,
          wordRegex,
          (match) => `[${match}](${glossaryWord.link})`
        )

        if (replaced) {
          // Update our mutable copy
          if (field.name === 'contentTop') contentTop = result
          else if (field.name === 'contentMiddle') contentMiddle = result
          else if (field.name === 'contentBottom') contentBottom = result

          usedWords.push(word)
          break
        }
      }
    })

    // Update form with final values
    if (contentTop !== (values.contentTop || '')) {
      form.onChange({ target: { name: 'contentTop', value: contentTop } })
    }
    if (contentMiddle !== (values.contentMiddle || '')) {
      form.onChange({ target: { name: 'contentMiddle', value: contentMiddle } })
    }
    if (contentBottom !== (values.contentBottom || '')) {
      form.onChange({ target: { name: 'contentBottom', value: contentBottom } })
    }

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
      values.contentTop || '',
      values.contentMiddle || '',
      values.contentBottom || '',
    ]
    const allContent = contentFields.join(' ')

    const escapeRegExp = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    // Extract all link texts from content
    const linkContentPattern = /\[([^\]]+)\]\([^)]+\)/gi
    const linkTexts = []
    let linkMatch
    while ((linkMatch = linkContentPattern.exec(allContent)) !== null) {
      linkTexts.push(linkMatch[1])
    }

    // Normalize subscript characters to regular digits
    const normalizeSubscripts = (string) => {
      const subscriptMap = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
      return string.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, char => subscriptMap[char] || char)
    }

    // Handle "(s)" optional plural notation
    const expandOptionalPlural = (word) => {
      if (word.endsWith('(s)')) {
        const base = word.slice(0, -3)
        return [base, base + 's']
      }
      return [word]
    }

    // Strip markdown formatting (bold, italic, code, strikethrough)
    const stripMarkdownFormatting = (text) => {
      return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`(.+?)`/g, '$1')
    }

    glossaryWords.forEach((glossaryWord) => {
      const word = glossaryWord.word
      const wordVariants = expandOptionalPlural(word)

      const patterns = new Set()
      for (const variant of wordVariants) {
        const normalizedWord = normalizeSubscripts(variant)
        patterns.add(escapeRegExp(variant))
        patterns.add(escapeRegExp(normalizedWord))
        patterns.add(escapeRegExp(pluralize.singular(normalizedWord)))
        patterns.add(escapeRegExp(pluralize.plural(normalizedWord)))
      }

      const wordPattern = Array.from(patterns).join('|')
      // Use full match - link text must BE the word, not just contain it
      const fullMatchRegex = new RegExp(`^(${wordPattern})$`, 'i')

      // Check if any link text exactly matches this word
      for (const linkText of linkTexts) {
        // Strip markdown formatting before matching
        const cleanLinkText = stripMarkdownFormatting(linkText.trim())
        if (fullMatchRegex.test(cleanLinkText)) {
          usedWords.push(glossaryWord)
          break
        }
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
