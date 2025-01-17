document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const searchButton = document.getElementById('searchButton');
  const resultsList = document.getElementById('resultsList');
  const summaryContent = document.getElementById('summaryContent');
  const historyList = document.getElementById('historyList');
  const resultTemplate = document.getElementById('result-item-template');
  const categorySelect = document.getElementById('categorySelect');

  // 存储键名常量
  const STORAGE_KEYS = {
    LAST_SEARCH: 'quickfind_last_search',
    LAST_RESULTS: 'quickfind_last_results',
    LAST_SUMMARY: 'quickfind_last_summary',
    SEARCH_HISTORY: 'quickfind_search_history'
  };

  // 初始化
  initializeUI();
  loadSearchHistory();
  restoreLastSearch();

  // 搜索按钮点击事件
  searchButton.addEventListener('click', () => {
    const keyword = searchInput.value.trim();
    if (keyword) {
      performSearch(keyword);
    }
  });

  // 回车键触发搜索
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const keyword = searchInput.value.trim();
      if (keyword) {
        performSearch(keyword);
      }
    }
  });

  // 初始化界面
  function initializeUI() {
    // 添加清除历史按钮
    const historyHeader = document.createElement('div');
    historyHeader.className = 'history-header';
    historyHeader.innerHTML = `
      <h3 class="section-title">搜索历史</h3>
      <button class="clear-history">清除历史</button>
    `;
    historyList.parentElement.insertBefore(historyHeader, historyList);

    // 绑定清除历史事件
    const clearHistoryBtn = document.querySelector('.clear-history');
    clearHistoryBtn.addEventListener('click', clearSearchHistory);
  }

  // 执行搜索
  async function performSearch(keyword) {
    try {
      showLoading();
      
      // 获取用户选择的类别
      const category = categorySelect.value;
      
      // 根据类别调整搜索关键词
      const adjustedKeyword = keyword.includes(category) ? keyword : `${category} ${keyword}`;
      
      // 保存到历史记录
      saveToHistory(adjustedKeyword);
      
      // 保存当前搜索关键词
      localStorage.setItem(STORAGE_KEYS.LAST_SEARCH, adjustedKeyword);

      // 发送搜索请求到后台脚本
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'search', keyword: adjustedKeyword, category: category },
          response => {
            if (response.status === 'success') {
              resolve(response);
            } else {
              reject(new Error(`搜索出错: ${response.message}`));
            }
          }
        );
      });

      // 过滤无用内容并确保与类别相关
      const filteredResults = response.results.filter(result => result.title && result.title.trim() !== '' && result.coreContent && result.coreContent.trim() !== '');

      // 保存搜索结果
      localStorage.setItem(STORAGE_KEYS.LAST_RESULTS, JSON.stringify(filteredResults));
      localStorage.setItem(STORAGE_KEYS.LAST_SUMMARY, response.aiSummary);

      displayResults(filteredResults);
      generateSummary(filteredResults, response.aiSummary);
      showStatusMessage('搜索完成', 'info');
    } catch (error) {
      console.error('搜索出错:', error);
      showError('搜索时发生错误，请稍后重试');
    } finally {
      hideLoading();
    }
  }

  // 恢复上次搜索
  function restoreLastSearch() {
    const lastSearch = localStorage.getItem(STORAGE_KEYS.LAST_SEARCH);
    const lastResults = localStorage.getItem(STORAGE_KEYS.LAST_RESULTS);
    const lastSummary = localStorage.getItem(STORAGE_KEYS.LAST_SUMMARY);

    if (lastSearch && lastResults) {
      searchInput.value = lastSearch;
      displayResults(JSON.parse(lastResults));
      generateSummary(JSON.parse(lastResults), lastSummary);
      
      showRestoreNotice();
    }
  }

  // 显示恢复提示
  function showRestoreNotice() {
    const notice = document.createElement('div');
    notice.className = 'restore-notice';
    notice.innerHTML = `
      <div class="message">已恢复上次的搜索结果</div>
      <div class="actions">
        <button class="confirm">重新搜索</button>
        <button class="dismiss">关闭</button>
      </div>
    `;

    document.body.appendChild(notice);

    notice.querySelector('.confirm').addEventListener('click', () => {
      performSearch(searchInput.value.trim());
      notice.remove();
    });

    notice.querySelector('.dismiss').addEventListener('click', () => {
      notice.remove();
    });

    setTimeout(() => {
      notice.remove();
    }, 5000);
  }

  // 显示状态消息
  function showStatusMessage(message, type = 'info') {
    const statusMsg = document.createElement('div');
    statusMsg.className = `status-message ${type}`;
    statusMsg.textContent = message;
    
    resultsList.parentElement.insertBefore(statusMsg, resultsList);

    setTimeout(() => {
      statusMsg.remove();
    }, 3000);
  }

  // 显示加载状态
  function showLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-content">
        <div class="loading-dots">
          <div></div>
          <div></div>
          <div></div>
        </div>
        <div class="loading-text">正在搜索中...</div>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }

  // 隐藏加载状态
  function hideLoading() {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
      loadingOverlay.remove();
    }
  }

  // 显示错误信息
  function showError(message) {
    hideLoading();
    showStatusMessage(message, 'warning');
    resultsList.innerHTML = `<div class="error">${message}</div>`;
  }

  // 加载搜索历史
  function loadSearchHistory() {
    chrome.storage.local.get(['searchHistory'], (result) => {
      const history = result.searchHistory || [];
      displayHistory(history);
    });
  }

  // 保存到历史记录
  function saveToHistory(keyword) {
    chrome.storage.local.get(['searchHistory'], (result) => {
      let history = result.searchHistory || [];
      
      // 移除重复项
      history = history.filter(item => item !== keyword);
      
      // 添加到开头
      history.unshift(keyword);
      
      // 限制历史记录数量
      if (history.length > 10) {
        history = history.slice(0, 10);
      }

      // 保存更新后的历史记录
      chrome.storage.local.set({ searchHistory: history }, () => {
        displayHistory(history);
      });
    });
  }

  // 清除搜索历史
  function clearSearchHistory() {
    chrome.storage.local.set({ searchHistory: [] }, () => {
      displayHistory([]);
      showStatusMessage('历史记录已清除', 'info');
    });
  }

  // 显示历史记录
  function displayHistory(history) {
    historyList.innerHTML = '';
    history.forEach(keyword => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.textContent = keyword;
      historyItem.addEventListener('click', () => {
        searchInput.value = keyword;
        performSearch(keyword);
      });
      historyList.appendChild(historyItem);
    });
  }

  // 显示搜索结果
  function displayResults(results) {
    if (!results || results.length === 0) {
      resultsList.innerHTML = '<div class="no-results">没有找到相关结果</div>';
      return;
    }

    resultsList.innerHTML = '';
    results.forEach(result => {
      const resultElement = resultTemplate.content.cloneNode(true);
      
      // 设置标题和链接
      const titleLink = resultElement.querySelector('h4 a');
      titleLink.href = result.link;
      titleLink.textContent = result.title;

      // 创建核心内容区域
      const coreContentDiv = document.createElement('div');
      coreContentDiv.className = 'core-content';
      
      // 添加核心要点
      if (result.coreContent?.main_points?.length > 0) {
        const mainPointsDiv = document.createElement('div');
        mainPointsDiv.className = 'main-points';
        mainPointsDiv.innerHTML = `
          <h5>核心要点</h5>
          <ul>
            ${result.coreContent.main_points.map(point => 
              `<li>${point}</li>`
            ).join('')}
          </ul>
        `;
        coreContentDiv.appendChild(mainPointsDiv);
      }

      // 添加关键发现
      if (result.coreContent?.key_findings) {
        const findingsDiv = document.createElement('div');
        findingsDiv.className = 'key-findings';
        findingsDiv.innerHTML = `
          <h5>主要发现</h5>
          <p>${result.coreContent.key_findings}</p>
        `;
        coreContentDiv.appendChild(findingsDiv);
      }

      // 添加重要引用
      if (result.coreContent?.important_quotes?.length > 0) {
        const quotesDiv = document.createElement('div');
        quotesDiv.className = 'important-quotes';
        quotesDiv.innerHTML = `
          <h5>重要引用</h5>
          ${result.coreContent.important_quotes.map(quote => 
            `<blockquote>${quote}</blockquote>`
          ).join('')}
        `;
        coreContentDiv.appendChild(quotesDiv);
      }

      // 添加实体标签
      if (result.coreContent?.entities?.length > 0) {
        const entitiesDiv = document.createElement('div');
        entitiesDiv.className = 'entities';
        entitiesDiv.innerHTML = `
          <div class="entity-tags">
            ${result.coreContent.entities.map(entity => 
              `<span class="entity-tag">${entity}</span>`
            ).join('')}
          </div>
        `;
        coreContentDiv.appendChild(entitiesDiv);
      }

      // 设置元数据标签
      const metadataDiv = document.createElement('div');
      metadataDiv.className = 'metadata-tags';
      metadataDiv.innerHTML = `
        <span class="metadata-tag content-type">${result.metadata.content_type}</span>
        <span class="metadata-tag reliability" data-score="${result.metadata.reliability_score}">
          可信度: ${result.metadata.reliability_score}/10
        </span>
        <span class="metadata-tag timeliness ${result.metadata.timeliness.toLowerCase()}">
          时效性: ${result.metadata.timeliness}
        </span>
        ${result.metadata.technical_level ? `
          <span class="metadata-tag technical-level ${result.metadata.technical_level.toLowerCase()}">
            技术深度: ${result.metadata.technical_level}
          </span>
        ` : ''}
      `;

      // 设置翻译文本和原文
      const translatedText = resultElement.querySelector('.translated-text');
      const originalText = resultElement.querySelector('.original-text');
      translatedText.textContent = result.snippet;
      originalText.textContent = result.originalSnippet || result.snippet;

      // 设置来源标签和AI评分
      const sourceTag = resultElement.querySelector('.source-tag');
      sourceTag.textContent = `${result.source} (AI评分: ${result.valueScore}/10)`;
      sourceTag.classList.add(result.source.toLowerCase().replace(' ', '-'));

      // 添加关键词标签
      const keywordsDiv = document.createElement('div');
      keywordsDiv.className = 'keywords';
      keywordsDiv.innerHTML = result.keywords.map(keyword => 
        `<span class="keyword-tag">${keyword}</span>`
      ).join('');

      // 将所有元素添加到结果中
      const contentDiv = resultElement.querySelector('.text-content');
      contentDiv.insertBefore(coreContentDiv, contentDiv.firstChild);
      contentDiv.appendChild(metadataDiv);
      contentDiv.appendChild(keywordsDiv);

      // 设置时间
      const timeSpan = resultElement.querySelector('.time');
      timeSpan.textContent = new Date(result.timestamp).toLocaleString();

      // 添加展开/收起功能
      const toggleButton = document.createElement('button');
      toggleButton.className = 'toggle-details';
      toggleButton.textContent = '展开详情';
      toggleButton.addEventListener('click', () => {
        const detailsContent = contentDiv.querySelector('.details-content');
        const isExpanded = detailsContent.classList.contains('expanded');
        detailsContent.classList.toggle('expanded');
        toggleButton.textContent = isExpanded ? '展开详情' : '收起详情';
      });

      // 添加翻译切换功能
      const translationToggle = resultElement.querySelector('.translation-toggle');
      if (result.originalSnippet) {
        translationToggle.addEventListener('click', () => {
          const isShowingOriginal = translatedText.classList.contains('hidden');
          translatedText.classList.toggle('hidden');
          originalText.classList.toggle('hidden');
          translationToggle.textContent = isShowingOriginal ? '显示原文' : '显示翻译';
        });
      } else {
        translationToggle.style.display = 'none';
      }

      resultsList.appendChild(resultElement);
    });
  }

  // 生成总结
  function generateSummary(results, aiSummary) {
    if (!results || results.length === 0) {
      summaryContent.innerHTML = '<div class="no-results">无法生成总结，没有找到相关结果</div>';
      return;
    }

    const summary = {
      totalResults: results.length,
      sources: new Set(results.map(r => r.source)).size,
      avgScore: (results.reduce((sum, r) => sum + r.valueScore, 0) / results.length).toFixed(1),
      topics: extractTopics(results)
    };

    summaryContent.innerHTML = `
      <div class="summary">
        <div class="stats">
          <p>找到 ${summary.totalResults} 条高价值信息，来自 ${summary.sources} 个不同来源</p>
          <p>平均AI评分：${summary.avgScore}/10</p>
          <p>主要话题：${summary.topics.join('、')}</p>
        </div>
        ${aiSummary ? `
          <div class="ai-summary">
            <h4>AI 深度分析</h4>
            <div class="ai-summary-content">${aiSummary.replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 提取主要话题
  function extractTopics(results) {
    const topics = new Set();
    results.forEach(result => {
      const words = result.title.split(' ');
      words.forEach(word => {
        if (word.length > 2) {
          topics.add(word);
        }
      });
    });
    return Array.from(topics).slice(0, 3);
  }

  let notes = []; // 存储所有创建的 note

  function openNoteWindow(title, content, link) {
    const noteWindow = window.open("", "NoteWindow", "width=400,height=auto,resizable=yes");
    
    // 写入内容到新窗口
    noteWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                    background-color: #ffffff;
                    color: #333;
                    overflow: hidden; /* 去除滚动条 */
                }
                .note-container {
                    position: relative; 
                    width: 100%;
                    height: 100%;
                    padding: 10px;
                    box-sizing: border-box;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                    border-radius: 8px;
                }
                .note-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .note-content {
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                .note-link {
                    font-size: 12px;
                    color: #007bff;
                    text-decoration: none;
                }
                .note-link:hover {
                    text-decoration: underline;
                }
                .close-btn {
                    position: absolute;
                    top: 5px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 14px;
                    cursor: pointer;
                }
            </style>
        </head>
        <body>
            <div class="note-container" id="noteContainer">
                <button class="close-btn" onclick="window.close()">×</button>
                <div class="note-title">${title}</div>
                <div class="note-content">${content}</div>
                <a href="${link}" target="_blank" class="note-link">查看原文</a>
            </div>
        </body>
        </html>
    `);

    // 在新窗口中添加拖动逻辑
    noteWindow.onload = function() {
        const noteContainer = noteWindow.document.getElementById('noteContainer');

        noteContainer.onmousedown = function(e) {
            let shiftX = e.clientX - noteContainer.getBoundingClientRect().left;
            let shiftY = e.clientY - noteContainer.getBoundingClientRect().top;

            function moveAt(pageX, pageY) {
                noteContainer.style.left = pageX - shiftX + 'px';
                noteContainer.style.top = pageY - shiftY + 'px';
            }

            // 移动鼠标时触发
            function onMouseMove(e) {
                moveAt(e.pageX, e.pageY);
            }

            noteWindow.document.addEventListener('mousemove', onMouseMove);

            // 释放鼠标时停止拖动
            noteWindow.document.onmouseup = function() {
                noteWindow.document.removeEventListener('mousemove', onMouseMove);
                noteWindow.document.onmouseup = null; // 清除事件
            };

            // 阻止文本选中
            noteContainer.ondragstart = function() {
                return false;
            };
        };
    };
  }

  // 更新现有的创建 Note 函数
  function triggerCreateNote() {
    const title = "你的标题"; // 动态设置
    const content = "这是你的内容"; // 动态设置
    const link = "https://example.com"; // 动态设置
    openNoteWindow(title, content, link);
  }

  // 为每个搜索结果的 Note 按钮添加事件监听
  resultsList.addEventListener('click', (e) => {
    if (e.target.classList.contains('note-btn')) {
      const resultItem = e.target.closest('.result-item');
      const title = resultItem.querySelector('h4 a').textContent;
      const content = resultItem.querySelector('.translated-text').textContent;
      const link = resultItem.querySelector('h4 a').href;
      openNoteWindow(title, content, link);
    }
  });
}); 