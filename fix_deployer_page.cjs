const fs = require('fs');

let content = fs.readFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', 'utf8');

// Replace leftSequence.map with sliced map
const targetMap = "{leftSequence.length > 0 ? leftSequence.map(vName => (";
const replacementMap = `{leftSequence.length > 0 ? (
              <>
                {leftSequence.slice((leftPage - 1) * itemsPerPage, leftPage * itemsPerPage).map(vName => (`

content = content.replace(targetMap, replacementMap);

// Find where the map ends and add the pagination controls
const targetEnd = `)) : (
                // 표시할 버전이 없을 때의 UI`;
const replacementEnd = `))}
                {leftSequence.length > itemsPerPage && (
                  <div className="flex justify-center p-4 bg-white border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      {Array.from({ length: Math.ceil(leftSequence.length / itemsPerPage) }).map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setLeftPage(i + 1)}
                          className={\`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-colors \${leftPage === i + 1 ? 'bg-[#000666] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}\`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
                // 표시할 버전이 없을 때의 UI`;

content = content.replace(targetEnd, replacementEnd);

fs.writeFileSync('src/features/deployer/DeploymentPipelineDashboardSection.jsx', content, 'utf8');
