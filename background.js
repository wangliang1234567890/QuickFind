const API_KEY = 'AIzaSyAQwuVjceL1-b4hsCHNc85Zg1pkXRVUM48';
const SEARCH_ENGINE_ID = '624e337ac3a66446d';
const TWITTER_BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAADfeyAEAAAAAXtF2Ad%2BKpUcCU4J6YwrWJJQt4aU%3DCMai2NbiNn1BPNwjKSRvKTO57r2c3QLxiVuvsHmmNjs2Te18xa';
const DEEPL_API_KEY = 'e7d8a93e-1e02-4e91-a36e-ecf6d767cc3e:fx';
const GEMINI_API_KEY = 'AIzaSyCpnXukUw6Wn1DO4ZvyhCuxS7SVJ4OaLFI';

// 监听插件安装事件
chrome.runtime.onInstalled.addListener(() => {
  // 初始化存储
  chrome.storage.local.set({
    searchHistory: []
  });
});

// 获取24小时前的时间戳
function get24HoursAgo() {
  const date = new Date();
  date.setHours(date.getHours() - 24);
  return date.toISOString();
}

// 标准化文本
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .normalize();
}

// 使用 DeepL API 翻译文本
async function translateText(text, targetLang = 'ZH') {
  if (!text) return '';
  
  try {
    const url = 'https://api-free.deepl.com/v2/translate';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`Translation HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translations[0].text;
  } catch (error) {
    console.error('Translation error:', error);
    return text; // 如果翻译失败，返回原文
  }
}

// 批量翻译文本
async function translateBatch(texts, targetLang = 'ZH') {
  if (!texts || texts.length === 0) return [];
  
  try {
    const url = 'https://api-free.deepl.com/v2/translate';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: texts,
        target_lang: targetLang,
      }),
    });

    if (!response.ok) {
      throw new Error(`Batch translation HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.translations.map(t => t.text);
  } catch (error) {
    console.error('Batch translation error:', error);
    return texts; // 如果翻译失败，返回原文数组
  }
}

// 翻译搜索结果
async function translateResults(results) {
  if (!results || results.length === 0) return results;

  const textsToTranslate = [];
  const indexMap = new Map();
  let currentIndex = 0;

  // 收集所有需要翻译的文本
  results.forEach((result, resultIndex) => {
    if (result.source === 'Google Search' || result.source === 'Twitter') {
      // 为标题和摘要分别创建索引映射
      indexMap.set(currentIndex, { resultIndex, field: 'title' });
      textsToTranslate.push(result.title);
      currentIndex++;

      indexMap.set(currentIndex, { resultIndex, field: 'snippet' });
      textsToTranslate.push(result.snippet);
      currentIndex++;
    }
  });

  try {
    // 批量翻译所有文本
    const translatedTexts = await translateBatch(textsToTranslate);

    // 使用翻译结果更新原始数据
    return results.map((result, index) => {
      if (result.source === 'Google Search' || result.source === 'Twitter') {
        const titleIndex = Array.from(indexMap.entries())
          .find(([_, value]) => value.resultIndex === index && value.field === 'title')[0];
        const snippetIndex = Array.from(indexMap.entries())
          .find(([_, value]) => value.resultIndex === index && value.field === 'snippet')[0];

        return {
          ...result,
          title: translatedTexts[titleIndex],
          snippet: translatedTexts[snippetIndex],
          originalTitle: result.title,
          originalSnippet: result.snippet
        };
      }
      return result;
    });
  } catch (error) {
    console.error('Results translation error:', error);
    return results;
  }
}

// 计算文本的相似度（使用 Levenshtein 距离）
function calculateSimilarity(str1, str2) {
  const matrix = Array(str2.length + 1).fill(null)
    .map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  const maxLength = Math.max(str1.length, str2.length);
  const distance = matrix[str2.length][str1.length];
  return 1 - (distance / maxLength);
}

// 执行 Google 搜索
async function performGoogleSearch(keyword) {
  console.log('Starting Google search for:', keyword);
  const timeRestrict = get24HoursAgo();
  // 优化搜索参数
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(keyword)}&dateRestrict=d1&num=10&safe=off&fields=items(title,link,snippet,pagemap)`;

  try {
    console.log('Fetching from Google API:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Google API response:', data);

    if (data.error) {
      throw new Error(`Google API error: ${data.error.message}`);
    }

    // 处理搜索结果
    const results = data.items?.map(item => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet || item.title, // 如果没有摘要，使用标题
      source: 'Google Search',
      timestamp: item.pagemap?.metatags?.[0]?.['article:published_time'] || new Date().toISOString(),
      normalizedTitle: normalizeText(item.title),
      normalizedSnippet: normalizeText(item.snippet || item.title)
    })) || [];

    console.log('Processed Google results:', results);
    return results;
  } catch (error) {
    console.error('Google Search API error:', error);
    return [];
  }
}

// 执行 Twitter 搜索
async function performTwitterSearch(keyword) {
  console.log('Starting Twitter search for:', keyword);
  // 优化 Twitter 搜索查询
  const query = encodeURIComponent(`${keyword} -is:retweet lang:zh OR lang:en`);
  const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id,text,entities,public_metrics&expansions=author_id&user.fields=name,username,verified`;

  try {
    console.log('Fetching from Twitter API:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${TWITTER_BEARER_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Twitter API response:', data);

    if (data.errors) {
      throw new Error(`Twitter API error: ${data.errors[0].message}`);
    }

    // 创建用户映射
    const users = new Map();
    if (data.includes?.users) {
      data.includes.users.forEach(user => {
        users.set(user.id, user);
      });
    }

    // 处理搜索结果
    const results = data.data?.map(tweet => {
      const user = users.get(tweet.author_id);
      const title = `${user?.name || 'User'} (@${user?.username || 'unknown'})${user?.verified ? ' ✓' : ''}`;
      const metrics = tweet.public_metrics || {};
      
      return {
        title: title,
        link: `https://twitter.com/${user?.username || 'unknown'}/status/${tweet.id}`,
        snippet: tweet.text,
        source: 'Twitter',
        timestamp: tweet.created_at,
        normalizedTitle: normalizeText(title),
        normalizedSnippet: normalizeText(tweet.text),
        metrics: {
          retweets: metrics.retweet_count || 0,
          likes: metrics.like_count || 0,
          replies: metrics.reply_count || 0
        }
      };
    }) || [];

    console.log('Processed Twitter results:', results);
    return results;
  } catch (error) {
    console.error('Twitter API error:', error);
    return [];
  }
}

// 高级去重函数
function removeDuplicatesAdvanced(results) {
  const uniqueResults = [];
  const seen = new Set();

  // 按时间戳排序（最新的优先）
  results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  for (const item of results) {
    let isDuplicate = false;

    // 检查是否有相似内容
    for (const seenItem of uniqueResults) {
      const titleSimilarity = calculateSimilarity(item.normalizedTitle, seenItem.normalizedTitle);
      const snippetSimilarity = calculateSimilarity(item.normalizedSnippet, seenItem.normalizedSnippet);

      // 如果标题或内容相似度超过阈值，认为是重复
      if (titleSimilarity > 0.8 || snippetSimilarity > 0.8) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueResults.push(item);
    }
  }

  return uniqueResults;
}

// 使用 Gemini API 分析内容价值和提取核心内容
async function analyzeContentValue(content, type = 'general') {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    // 根据内容类型定制提示词
    let prompt = `
      请对以下内容进行深度分析。

      内容类型：${type}
      内容：${content}

      请以JSON格式返回以下分析结果：
      {
        "score": "1-10的评分，10分最高",
        "analysis": "简要分析",
        "keywords": ["最重要的关键词，最多5个"],
        "relevance": "高/中/低",
        "core_content": {
          "main_points": ["核心要点，最多3点"],
          "key_findings": "最重要的发现或结论",
          "important_quotes": ["最有价值的引用或句子，最多2条"],
          "entities": ["提到的重要实体，如人物、组织、技术等"]
        },
        "metadata": {
          "content_type": "新闻/社交媒体/技术文档/其他",
          "reliability_score": "1-10的可信度评分",
          "timeliness": "时效性评估：高/中/低",
          "technical_level": "技术内容深度：高/中/低"
        }
      }
    `;

    // 对于特定类型的内容，添加额外的分析要求
    if (type === 'technical') {
      prompt += `
        请特别关注：
        - 技术概念的准确性
        - 技术趋势和发展方向
        - 实现难度和可行性
        - 技术影响力评估
      `;
    } else if (type === 'news') {
      prompt += `
        请特别关注：
        - 新闻事件的重要性
        - 信息来源的可靠性
        - 事件影响范围
        - 后续发展预测
      `;
    } else if (type === 'social') {
      prompt += `
        请特别关注：
        - 社交媒体影响力
        - 观点的代表性
        - 互动数据分析
        - 舆论倾向
      `;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    try {
      const analysisText = data.candidates[0].content.parts[0].text;
      const analysis = JSON.parse(analysisText);
      
      // 根据元数据调整最终分数
      let finalScore = analysis.score;
      
      // 根据可信度调整分数
      finalScore += (analysis.metadata.reliability_score - 5) * 0.2;
      
      // 根据时效性调整分数
      if (analysis.metadata.timeliness === '高') finalScore += 1;
      else if (analysis.metadata.timeliness === '低') finalScore -= 1;
      
      // 根据相关性调整分数
      if (analysis.relevance === '高') finalScore += 1;
      else if (analysis.relevance === '低') finalScore -= 1;
      
      // 确保分数在1-10范围内
      analysis.score = Math.max(1, Math.min(10, finalScore));
      
      return analysis;
    } catch (e) {
      console.error('Error parsing Gemini response:', e);
      return {
        score: 5,
        analysis: "无法解析AI分析结果",
        keywords: [],
        relevance: "中",
        core_content: {
          main_points: [],
          key_findings: "无法提取核心内容",
          important_quotes: [],
          entities: []
        },
        metadata: {
          content_type: "未知",
          reliability_score: 5,
          timeliness: "中",
          technical_level: "中"
        }
      };
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      score: 5,
      analysis: "AI分析过程出错",
      keywords: [],
      relevance: "中",
      core_content: {
        main_points: [],
        key_findings: "内容分析失败",
        important_quotes: [],
        entities: []
      },
      metadata: {
        content_type: "未知",
        reliability_score: 5,
        timeliness: "中",
        technical_level: "中"
      }
    };
  }
}

// 批量分析内容
async function analyzeResults(results) {
  const analysisPromises = results.map(async result => {
    // 确定内容类型
    let contentType = 'general';
    if (result.source === 'Twitter') {
      contentType = 'social';
    } else if (result.title.toLowerCase().includes('news') || 
               result.link.includes('/news/') ||
               result.source.toLowerCase().includes('news')) {
      contentType = 'news';
    } else if (result.title.match(/\b(api|sdk|framework|programming|code|tech|ai|ml)\b/i) ||
               result.snippet.match(/\b(api|sdk|framework|programming|code|tech|ai|ml)\b/i)) {
      contentType = 'technical';
    }

    const content = `
      标题：${result.title}
      内容：${result.snippet}
      来源：${result.source}
      ${result.metrics ? `
      互动数据：
      - 转发：${result.metrics.retweets}
      - 点赞：${result.metrics.likes}
      - 评论：${result.metrics.replies}
      ` : ''}
    `;

    const analysis = await analyzeContentValue(content, contentType);
    return {
      ...result,
      valueScore: analysis.score,
      valueAnalysis: analysis.analysis,
      keywords: analysis.keywords,
      coreContent: analysis.core_content,
      metadata: analysis.metadata
    };
  });

  return Promise.all(analysisPromises);
}

// 根据价值分数和元数据过滤和排序结果
function filterAndSortByValue(results, minScore = 5) {
  return results
    .filter(result => result.valueScore >= minScore)
    .sort((a, b) => {
      // 计算综合得分
      const getCompositeScore = (item) => {
        let score = item.valueScore;
        
        // 考虑可靠性
        score += (item.metadata.reliability_score - 5) * 0.3;
        
        // 考虑时效性
        if (item.metadata.timeliness === '高') score += 1;
        else if (item.metadata.timeliness === '低') score -= 0.5;
        
        // 对于技术内容，考虑技术深度
        if (item.metadata.content_type === '技术文档') {
          if (item.metadata.technical_level === '高') score += 1;
        }
        
        // 考虑社交媒体互动
        if (item.source === 'Twitter' && item.metrics) {
          const engagement = (item.metrics.likes + item.metrics.retweets * 2 + item.metrics.replies * 3) / 100;
          score += Math.min(2, engagement); // 最多加2分
        }
        
        return score;
      };

      const scoreA = getCompositeScore(a);
      const scoreB = getCompositeScore(b);
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      // 分数相同时按时间排序
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
}

// 生成内容摘要
async function generateSummary(results) {
  if (!results || results.length === 0) return null;

  const prompt = `
    请对以下信息进行综合分析和总结：
    ${results.map(r => `
      标题：${r.title}
      内容：${r.snippet}
      价值评分：${r.valueScore}
      分析：${r.valueAnalysis}
    `).join('\n\n')}

    请提供：
    1. 核心要点总结（不超过3点）
    2. 主要发现
    3. 建议关注的方向
  `;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Summary generation error:', error);
    return null;
  }
}

// 修改合并搜索结果函数
async function performCombinedSearch(keyword) {
  console.log('Starting combined search for:', keyword);
  try {
    const [googleResults, twitterResults] = await Promise.all([
      performGoogleSearch(keyword).catch(err => {
        console.error('Google search failed:', err);
        return [];
      }),
      performTwitterSearch(keyword).catch(err => {
        console.error('Twitter search failed:', err);
        return [];
      })
    ]);

    const combinedResults = [...googleResults, ...twitterResults];
    console.log('Combined results:', combinedResults);
    
    // 翻译结果
    const translatedResults = await translateResults(combinedResults);
    console.log('Translated results:', translatedResults);
    
    // 使用 Gemini 分析内容价值
    const analyzedResults = await analyzeResults(translatedResults);
    console.log('Analyzed results:', analyzedResults);
    
    // 过滤和排序结果
    const filteredResults = filterAndSortByValue(analyzedResults);
    console.log('Filtered results:', filteredResults);
    
    // 生成AI总结
    const aiSummary = await generateSummary(filteredResults);
    console.log('AI Summary:', aiSummary);
    
    return {
      results: filteredResults,
      summary: aiSummary
    };
  } catch (error) {
    console.error('Combined search error:', error);
    return {
      results: [],
      summary: null
    };
  }
}

// 修改消息处理函数
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'search') {
    console.log('Received search request:', request);
    performCombinedSearch(request.keyword)
      .then(({results, summary}) => {
        console.log('Search completed, processing results');
        // 使用高级去重和排序
        const processedResults = removeDuplicatesAdvanced(results);
        console.log('Sending response with processed results:', processedResults);
        sendResponse({ 
          status: 'success',
          results: processedResults,
          aiSummary: summary
        });
      })
      .catch(error => {
        console.error('Error in search process:', error);
        sendResponse({ 
          status: 'error',
          message: error.message || '搜索过程中发生错误'
        });
      });
    return true; // 保持消息通道开放
  }
}); 