import React, { useState, useEffect, useRef } from 'react';
import { 
  Scale, 
  BookOpen, 
  Brain, 
  Gavel, 
  AlertTriangle, 
  Loader2, 
  FileText,
  ChevronRight,
  Info,
  Search,
  FileEdit,
  Copy,
  CheckCircle2
} from 'lucide-react';

// --- API Configuration ---
// 请将您在 Google AI Studio 申请的 API Key 填入下方的双引号中
const apiKey = "AIzaSyCebd-shlPrU-rGlSIHdbssq_yrg8r6DTU"; 

// 指数退避重试函数（保证网络波动时的稳定性）
const fetchWithRetry = async (url, options, retries = 5) => {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
};

// 核心功能：分析案件
const analyzeCase = async (caseText) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const systemInstruction = `你是一个专业、严谨的中国人工智能法律助手和虚拟法官。
你的任务是仔细阅读用户提供的案情描述，并提供结构化的法律分析。
请务必客观、中立，依据现行有效的《中华人民共和国民法典》、《刑法》、《劳动法》等相关法律法规进行分析。
如果案情描述模糊，请基于常理进行最有可能的推断，并在分析中指出。`;

  const payload = {
    contents: [{ parts: [{ text: `请分析以下案件，并提取关键法律条文和基础判决预测：\n\n${caseText}` }] }],
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          summary: { type: "STRING", description: "案情的一句话核心摘要" },
          laws: {
            type: "ARRAY",
            description: "适用的主要法律条文列表",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING", description: "法律名称，例如《中华人民共和国刑法》" },
                article: { type: "STRING", description: "条文序号，例如 第一百三十三条之一" },
                content: { type: "STRING", description: "法条的核心内容简述" },
                relevance: { type: "STRING", description: "该法条与本案的关联性说明" }
              },
              required: ["name", "article", "content", "relevance"]
            }
          },
          analysis: { type: "STRING", description: "法理分析过程，分点说明" },
          judgment: { type: "STRING", description: "基础判决预测（包括可能的刑罚、赔偿责任、责任划分等）" },
          disclaimer: { type: "STRING", description: "免责声明" }
        },
        required: ["summary", "laws", "analysis", "judgment", "disclaimer"]
      }
    }
  };

  const data = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  return JSON.parse(data.candidates[0].content.parts[0].text);
};

// 新功能 1：挖掘案情疑点 (使用 JSON 数组输出)
const findCaseLoopholes = async (caseText) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: `阅读以下案情，指出其中缺失的、可能会严重影响最终判决方向的关键细节或需要进一步调查的疑点。最多提 3-4 个问题。\n\n案情：${caseText}` }] }],
    systemInstruction: { parts: [{ text: "你是一位资深诉讼律师。请一针见血地指出案情描述中缺失的证据或关键事实。例如：'是否有现场监控？'，'对方是否处于醉酒状态？'等。请以数组形式直接返回问题。" }] },
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: { type: "STRING" } }
    }
  };
  const data = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return JSON.parse(data.candidates[0].content.parts[0].text);
};

// 新功能 2：起草法律文书 (标准文本生成)
const draftLegalDocument = async (caseText, summary) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: `根据以下案情和AI分析摘要，为受害方/原告起草一份标准的中国法律文书（如《民事起诉状》、《劳动仲裁申请书》等，视案情而定）。\n\n案情：${caseText}\n\n分析摘要：${summary}` }] }],
    systemInstruction: { parts: [{ text: "你是一位精通文书写作的专业律师。请输出格式严谨的法律文书草稿。未知的信息（如姓名、地址、身份证号、具体金额）请用 'XXX' 占位。直接输出文书正文，不需要任何前言或解释语句。" }] }
  };
  const data = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return data.candidates[0].content.parts[0].text;
};

export default function App() {
  const [caseInput, setCaseInput] = useState("");
  const [error, setError] = useState(null);
  
  // 状态管理
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  
  const [isFindingLoopholes, setIsFindingLoopholes] = useState(false);
  const [loopholes, setLoopholes] = useState(null);

  const [isDrafting, setIsDrafting] = useState(false);
  const [draftedDoc, setDraftedDoc] = useState(null);
  const [copied, setCopied] = useState(false);

  const resultRef = useRef(null);
  const docRef = useRef(null);

  const sampleCases = [
    "张三在未取得机动车驾驶证的情况下，大量饮酒后驾驶一辆小型轿车在城市主干道行驶，因操作不当撞毁了路边的市政护栏，车辆受损严重。经交警部门现场呼气及后续抽血鉴定，张三血液中的酒精含量达到了 165mg/100ml。事故未造成其他人员伤亡。",
    "李四入职某科技公司担任程序员，双方签订了为期3年的劳动合同。工作半年后，公司以“业务调整”为由单方面通知李四解除劳动合同，且拒绝支付任何经济补偿金。李四在职期间每月工资为15000元，平时没有违纪行为。",
    "王五在某电商平台购买了一台标称“全新正品原装”的知名品牌手机，花费6000元。收到货后，王五发现手机屏幕有轻微划痕，且通过官方渠道查询序列号发现该手机在一年前已经被激活过，属于翻新机。王五联系商家要求退一赔三，商家以“已拆封不退换”为由拒绝。"
  ];

  const handleAnalyze = async () => {
    if (!caseInput.trim()) {
      setError("请输入或选择一个案情描述以进行分析。");
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    setDraftedDoc(null);
    try {
      const analysisResult = await analyzeCase(caseInput);
      setResult(analysisResult);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      console.error(err);
      setError("分析过程中发生错误，请稍后重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFindLoopholes = async () => {
    if (!caseInput.trim()) return;
    setIsFindingLoopholes(true);
    setError(null);
    try {
      const issues = await findCaseLoopholes(caseInput);
      setLoopholes(issues);
    } catch (err) {
      console.error(err);
      setError("挖掘疑点时发生错误。");
    } finally {
      setIsFindingLoopholes(false);
    }
  };

  const handleDraftDoc = async () => {
    if (!caseInput || !result) return;
    setIsDrafting(true);
    try {
      const doc = await draftLegalDocument(caseInput, result.summary);
      setDraftedDoc(doc);
      setTimeout(() => docRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (err) {
      console.error(err);
      setError("生成法律文书时发生错误。");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopy = () => {
    if (draftedDoc) {
      document.execCommand('copy');
      navigator.clipboard.writeText(draftedDoc).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        const textArea = document.createElement("textarea");
        textArea.value = draftedDoc;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("Copy");
        textArea.remove();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const loadSample = (text) => {
    setCaseInput(text);
    setError(null);
    setLoopholes(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-16">
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-lg">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI 法律案件分析助手</h1>
            <p className="text-slate-300 text-xs mt-1">智能梳理法条 · 挖掘疑点 · 一键起草文书</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">输入案情描述</h2>
              </div>
              
              <textarea
                className="w-full h-56 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none bg-slate-50"
                placeholder="请详细描述案件的起因、经过、结果以及涉及的人员和金额等关键信息..."
                value={caseInput}
                onChange={(e) => setCaseInput(e.target.value)}
                disabled={isAnalyzing || isFindingLoopholes}
              ></textarea>

              {loopholes && loopholes.length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-xl animate-fade-in">
                  <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
                    <Search className="w-4 h-4" /> 补充关键信息建议
                  </h4>
                  <ul className="list-disc pl-5 text-sm text-orange-700 space-y-1">
                    {loopholes.map((lh, i) => (
                      <li key={i}>{lh}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-orange-600 mt-2 opacity-80">完善上述细节后，分析结果将更准确。</p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 animate-fade-in">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleFindLoopholes}
                  disabled={isFindingLoopholes || isAnalyzing || !caseInput.trim()}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isFindingLoopholes ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5 text-amber-500" />}
                  ✨ 挖掘案情疑点
                </button>

                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isFindingLoopholes || !caseInput.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                  开始智能分析
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
               <div className="flex items-center gap-2 mb-4">
                <Info className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-700">尝试使用预设案例</h3>
              </div>
              <div className="flex flex-col gap-2">
                {sampleCases.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadSample(sample)}
                    disabled={isAnalyzing || isFindingLoopholes}
                    className="text-left text-sm p-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-slate-600 truncate"
                  >
                    案例 {idx + 1}: {sample.substring(0, 30)}...
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7" ref={resultRef}>
            {!result && !isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl shadow-sm border border-slate-200 border-dashed p-12 text-center min-h-[400px]">
                <Scale className="w-16 h-16 mb-4 text-slate-200" />
                <p className="text-lg font-medium text-slate-500">等待案情输入</p>
                <p className="text-sm mt-2 max-w-sm">在左侧输入框内详细描述您的案件，您可以先"挖掘疑点"，再进行深度"智能分析"。</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center min-h-[400px]">
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <Scale className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </div>
                <h3 className="text-xl font-semibold mt-6 text-slate-800">正在查阅法律法规...</h3>
                <p className="text-slate-500 mt-2 text-sm">正在构建逻辑链条并生成分析报告，请稍候。</p>
              </div>
            )}

            {result && !isAnalyzing && (
              <div className="flex flex-col gap-6 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center gap-3">
                    <div className="bg-blue-100 p-1.5 rounded-md">
                      <FileText className="w-5 h-5 text-blue-700" />
                    </div>
                    <h2 className="text-lg font-semibold text-blue-900">案情摘要</h2>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {result.summary}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center gap-3">
                    <div className="bg-emerald-100 p-1.5 rounded-md">
                      <BookOpen className="w-5 h-5 text-emerald-700" />
                    </div>
                    <h2 className="text-lg font-semibold text-emerald-900">适用法律条文</h2>
                  </div>
                  <div className="p-0">
                    <ul className="divide-y divide-slate-100">
                      {result.laws.map((law, index) => (
                        <li key={index} className="p-6 hover:bg-slate-50 transition-colors">
                          <div className="flex items-start gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold mt-0.5">
                              {index + 1}
                            </span>
                            <div>
                              <h4 className="font-bold text-slate-900 text-base">
                                {law.name} <span className="text-emerald-700 ml-1">{law.article}</span>
                              </h4>
                              <p className="mt-2 text-sm text-slate-600 bg-slate-100 p-3 rounded-lg border border-slate-200">
                                {law.content}
                              </p>
                              <div className="mt-3 flex items-start gap-2">
                                <ChevronRight className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-slate-700">
                                  <span className="font-semibold text-slate-800">关联性：</span>
                                  {law.relevance}
                                </p>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex items-center gap-3">
                    <div className="bg-amber-100 p-1.5 rounded-md">
                      <Brain className="w-5 h-5 text-amber-700" />
                    </div>
                    <h2 className="text-lg font-semibold text-amber-900">法理分析</h2>
                  </div>
                  <div className="p-6">
                    <div className="text-slate-700 leading-relaxed text-sm whitespace-pre-line space-y-4">
                      {result.analysis}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden relative">
                   <div className="absolute -right-10 -top-10 text-slate-800 opacity-50">
                      <Gavel className="w-48 h-48" />
                   </div>
                  <div className="relative z-10">
                    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-3">
                      <div className="bg-rose-500 p-1.5 rounded-md">
                        <Gavel className="w-5 h-5 text-white" />
                      </div>
                      <h2 className="text-lg font-bold text-white tracking-wide">基础判决预测</h2>
                    </div>
                    <div className="p-6">
                      <p className="text-slate-200 leading-relaxed text-lg font-medium whitespace-pre-line">
                        {result.judgment}
                      </p>
                    </div>
                  </div>
                </div>

                {!draftedDoc && (
                  <button
                    onClick={handleDraftDoc}
                    disabled={isDrafting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-4 px-6 rounded-2xl shadow-md transition-all flex items-center justify-center gap-3 text-lg animate-fade-in"
                  >
                    {isDrafting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> 正在执笔起草中...</>
                    ) : (
                      <><FileEdit className="w-6 h-6" /> ✨ 结合案情，一键生成起诉状/法律文书模板</>
                    )}
                  </button>
                )}

                {draftedDoc && (
                  <div ref={docRef} className="bg-white rounded-2xl shadow-lg border border-indigo-200 overflow-hidden animate-fade-in">
                    <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-1.5 rounded-md">
                          <FileEdit className="w-5 h-5 text-indigo-700" />
                        </div>
                        <h2 className="text-lg font-semibold text-indigo-900">法律文书草案</h2>
                      </div>
                      <button 
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm text-indigo-700 hover:bg-indigo-100 transition-colors"
                      >
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        {copied ? '已复制' : '复制全文'}
                      </button>
                    </div>
                    <div className="p-6 bg-[#fafafa]">
                      <div className="font-serif text-slate-800 leading-loose whitespace-pre-wrap max-h-[600px] overflow-y-auto pr-4 custom-scrollbar text-base">
                        {draftedDoc}
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-slate-100 rounded-xl p-4 flex items-start gap-3 border border-slate-200">
                  <AlertTriangle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    <strong>免责声明：</strong> {result.disclaimer || "本系统提供的分析报告及判决预测仅基于自然语言处理技术生成，仅供参考，不具有任何法律效力。实际案件的判决受多种因素影响，如需正式法律建议，请务必咨询专业律师或寻求司法机关帮助。"}
                  </p>
                </div>

              </div>
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1; 
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; 
        }
      `}} />
    </div>
  );
}