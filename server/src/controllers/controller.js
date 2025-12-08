const controller = ({ strapi }) => ({
  async getGlossaryWords(ctx) {
    const articleId = ctx.request.query.article

    if (!articleId) {
      ctx.throw(400, 'Article ID is required')
    }

    try {
      const article = await strapi.documents('api::article.article').findOne({
        documentId: articleId,
        populate: ['articleCategory'],
      });

      if (!article) {
        ctx.throw(404, 'Article not found')
      }

      const categoryId = article?.articleCategory?.documentId || null

      if (!categoryId) {
        ctx.throw(404, 'Article category not found')
      }

      const categoryWords = await strapi.documents('api::glossary-word.glossary-word').findMany({
        filters: {
          article_categories: {
            documentId: categoryId,
          },
        },
      });

      const allWords = await strapi.documents('api::glossary-word.glossary-word').findMany({
        populate: ['article_categories'],
      });

      const globalWords = allWords.filter(word =>
        !word.article_categories || word.article_categories.length === 0
      );

      const globalWordsSet = new Set(globalWords.map(w => w.documentId));

      const glossaryWordsMap = new Map();
      [...categoryWords, ...globalWords].forEach(word => {
        glossaryWordsMap.set(word.documentId, word);
      });
      let glossaryWords = Array.from(glossaryWordsMap.values());

      const config = strapi.config.get('plugin::glossary-magic')

      glossaryWords = glossaryWords.map((glossaryWord) => {
        const isGlobal = globalWordsSet.has(glossaryWord.documentId);
        const baseLink = `${config.glossaryBaseUrl}?search=${encodeURIComponent(glossaryWord.word)}`;

        return {
          ...glossaryWord,
          link: isGlobal ? baseLink : `${baseLink}&category=${encodeURIComponent(article.articleCategory.category)}`,
        }
      })

      ctx.body = glossaryWords;
    } catch (error) {
      console.error('Error fetching glossary words:', error)
      ctx.throw(500, 'An error occurred while fetching glossary words')
    }
  },
  async connectGlossaryWords(ctx) {
    const articleId = ctx.request.body.article
    const allWords = ctx.request.body.allWords
    const wordsToConnect = ctx.request.body.wordsToConnect

    if (!articleId) {
      ctx.throw(400, 'Article ID is required')
    }

    if (!allWords || !Array.isArray(allWords) || allWords.length === 0) {
      ctx.throw(400, 'All words are required')
    }

    if (!wordsToConnect || !Array.isArray(wordsToConnect) || wordsToConnect.length === 0) {
      ctx.throw(400, 'Words to connect are required')
    }

    try {
      const glossaryWords = await strapi.documents('api::glossary-word.glossary-word').findMany({
        filters: {
          documentId: {
            $in: allWords,
          },
        },
        populate: ['articles'],
      })

      const article = await strapi.documents('api::article.article').findOne({
        documentId: articleId,
      });

      if (!article) {
        ctx.throw(404, 'Article not found')
      }

      for (let i = 0; i < glossaryWords.length; i++) {
        const glossaryWord = glossaryWords[i]

        if (wordsToConnect.includes(glossaryWord.documentId)) {
          await strapi.documents('api::glossary-word.glossary-word').update({
            documentId: glossaryWord.documentId,
            data: {
              articles: {
                connect: [article.documentId]
              }
            }
          })
        } else {
          await strapi.documents('api::glossary-word.glossary-word').update({
            documentId: glossaryWord.documentId,
            data: {
              articles: {
                disconnect: [article.documentId]
              }
            }
          })
        }
      }

      ctx.body = 'Glossary words connected successfully!'
    } catch (error) {
      console.error('Error connecting glossary words:', error)
      ctx.throw(500, 'An error occurred while connecting glossary words')
    }
  },
  async disconnectGlossaryWords(ctx) {
    const articleId = ctx.request.body.article

    if (!articleId) {
      ctx.throw(400, 'Article ID is required')
    }

    try {
      const article = await strapi.documents('api::article.article').findOne({
        documentId: articleId,
        populate: ['articleCategory'],
      });

      if (!article) {
        ctx.throw(404, 'Article not found')
      }

      let glossaryWords = await strapi.documents('api::glossary-word.glossary-word').findMany({
        filters: {
          articles: {
            documentId: article.documentId,
          },
        },
      });

      for (let i = 0; i < glossaryWords.length; i++) {
        const glossaryWord = glossaryWords[i]

        await strapi.documents('api::glossary-word.glossary-word').update({
          documentId: glossaryWord.documentId,
          data: {
            articles: {
              disconnect: [article.documentId]
            }
          }
        })
      }

      ctx.body = 'Glossary words disconnected successfully!'
    } catch (error) {
      console.error('Error disconnecting glossary words:', error)
      ctx.throw(500, 'An error occurred while disconnect glossary words')
    }
  }
})

export default controller;
