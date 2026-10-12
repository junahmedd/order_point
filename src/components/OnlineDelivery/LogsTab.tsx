import React from 'react';

interface WebhookLog {
  id: string;
  timestamp: number;
  source: 'Swiggy' | 'Zomato';
  eventType: string;
  status: '200 OK' | '500 Error' | 'Pending';
  payload: string;
  response: string;
}

interface LogsTabProps {
  webhookLogs: WebhookLog[];
  setWebhookLogs: React.Dispatch<React.SetStateAction<WebhookLog[]>>;
}

export default function LogsTab({ webhookLogs, setWebhookLogs }: LogsTabProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-150 p-5 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pb-3 border-b border-gray-50 shrink-0">
        <div>
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Live Webhook Logs</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Real-time trace of API events, webhook calls, and response statuses.</p>
        </div>
        <button 
          onClick={() => {
            setWebhookLogs([]);
          }}
          className="px-3 py-1.5 text-[10px] font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
        >
          Clear Logs
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hidden-scrollbar min-h-0 border border-gray-100 rounded-xl mt-3">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-100">
            <tr className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
              <th className="py-2.5 px-4">Timestamp</th>
              <th className="py-2.5 px-4">Platform</th>
              <th className="py-2.5 px-4">Event Type</th>
              <th className="py-2.5 px-4">API Status</th>
              <th className="py-2.5 px-4">Request Body</th>
              <th className="py-2.5 px-4">Response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 font-medium text-gray-600">
            {webhookLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400 font-normal">
                  No webhook events recorded in live database. Make connection tests to populate logs!
                </td>
              </tr>
            ) : (
              webhookLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 font-mono text-[10px]">
                  <td className="py-2.5 px-4 text-gray-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      log.source === 'Swiggy' ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'
                    }`}>
                      {log.source}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-gray-800 font-bold">{log.eventType}</td>
                  <td className="py-2.5 px-4">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-black ${
                      log.status === '200 OK' ? 'bg-emerald-50 text-emerald-600' :
                      log.status === 'Pending' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                      'bg-rose-50 text-rose-600'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 max-w-[200px] truncate text-gray-500" title={log.payload}>
                    {log.payload}
                  </td>
                  <td className="py-2.5 px-4 max-w-[200px] truncate text-gray-500" title={log.response}>
                    {log.response}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
