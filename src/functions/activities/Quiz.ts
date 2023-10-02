import { Page } from 'puppeteer'

import { getLatestTab } from '../../BrowserUtil'
import { getQuizData, waitForQuizRefresh } from '../../BrowserFunc'
import { wait } from '../../util/Utils'
import { log } from '../../util/Logger'

import { MorePromotion, PromotionalItem } from '../../interface/DashboardData'

export async function doQuiz(page: Page, data: PromotionalItem | MorePromotion) {
    log('QUIZ', 'Trying to complete quiz')

    try {
        const selector = `[data-bi-id="${data.offerId}"]`

        // Wait for page to load and click to load the quiz in a new tab
        await page.waitForSelector(selector, { timeout: 5000 })
        await page.click(selector)

        const quizPage = await getLatestTab(page)

        // Check if the quiz has been started or not
        const quizNotStarted = await quizPage.waitForSelector('#rqStartQuiz', { visible: true, timeout: 3000 }).then(() => true).catch(() => false)
        if (quizNotStarted) {
            await quizPage.click('#rqStartQuiz')
        } else {
            log('QUIZ', 'Quiz has already been started, trying to finish it')
        }

        await wait(2000)

        const quizData = await getQuizData(quizPage)
        const questionsRemaining = quizData.maxQuestions - quizData.CorrectlyAnsweredQuestionCount // Amount of questions remaining

        // All questions
        for (let question = 0; question < questionsRemaining; question++) {

            if (quizData.numberOfOptions === 8) {
                const answers: string[] = []

                for (let i = 0; i < quizData.numberOfOptions; i++) {
                    const answerSelector = await quizPage.waitForSelector(`#rqAnswerOption${i}`, { visible: true, timeout: 5000 })
                    const answerAttribute = await answerSelector?.evaluate(el => el.getAttribute('iscorrectoption'))
                    await wait(500)

                    if (answerAttribute && answerAttribute.toLowerCase() === 'true') {
                        answers.push(`#rqAnswerOption${i}`)
                    }
                }

                // Click the answers
                for (const answer of answers) {
                    await quizPage.waitForSelector(answer, { visible: true, timeout: 2000 })

                    // Click the answer on page
                    await quizPage.click(answer)

                    const refreshSuccess = await waitForQuizRefresh(quizPage)
                    if (!refreshSuccess) {
                        await quizPage.close()
                        log('QUIZ', 'An error occurred, refresh was unsuccessful', 'error')
                        return
                    }
                }

                // Other type quiz
            } else if ([2, 3, 4].includes(quizData.numberOfOptions)) {
                const correctOption = quizData.correctAnswer

                for (let i = 0; i < quizData.numberOfOptions; i++) {

                    const answerSelector = await quizPage.waitForSelector(`#rqAnswerOption${i}`, { visible: true, timeout: 5000 })
                    const dataOption = await answerSelector?.evaluate(el => el.getAttribute('data-option'))

                    if (dataOption === correctOption) {
                        // Click the answer on page
                        await quizPage.click(`#rqAnswerOption${i}`)
                        await wait(2000)

                        const refreshSuccess = await waitForQuizRefresh(quizPage)
                        if (!refreshSuccess) {
                            await quizPage.close()
                            log('QUIZ', 'An error occurred, refresh was unsuccessful', 'error')
                            return
                        }
                    }
                }
                await wait(2000)

            }

        }

        // Done with
        await wait(2000)
        await quizPage.close()
        log('QUIZ', 'Completed the quiz successfully')
    } catch (error) {
        const quizPage = await getLatestTab(page)
        await quizPage.close()
        log('QUIZ', 'An error occurred:' + JSON.stringify(error, null, 2), 'error')
    }

}