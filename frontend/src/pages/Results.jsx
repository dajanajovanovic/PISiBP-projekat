import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function Results() {
  const { id } = useParams();
  const [agg, setAgg] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([api.aggregate(id), api.listResponses(id)]);
      setAgg(a);
      setItems(r);
    } catch (e) {
      alert(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Results</h1>
        <div className="flex gap-2">
          <a className="btn" href={api.exportXlsx(id)}>Export XLSX</a>
          <Link className="btn" to={`/forms/${id}/edit`}>Back to editor</Link>
        </div>
      </div>

      {loading ? <div>Loading...</div> : (
        <>
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Aggregate</h2>
            {!agg ? <div className="text-sm text-gray-600">No data.</div> : (
              <pre className="text-xs overflow-auto">{JSON.stringify(agg, null, 2)}</pre>
            )}
          </div>

          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Individual responses</h2>
            {items.length === 0 ? <div className="text-sm text-gray-600">No responses.</div> : (
              <div className="grid gap-2">
                {items.map((it) => (
                  <div key={it.id} className="border rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">#{it.id}</div>
                    <pre className="text-xs overflow-auto">{JSON.stringify(it, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
