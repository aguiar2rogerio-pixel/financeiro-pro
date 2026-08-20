/* SERVICE WORKER COM AUTO-REFRESH */
      if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
              navigator.serviceWorker.register('./sw.js').then((reg) => {
                  console.log('Service Worker registrado:', reg.scope);
                  
                  reg.onupdatefound = () => {
                      const installingWorker = reg.installing;
                      installingWorker.onstatechange = () => {
                          if (installingWorker.state === 'installed') {
                              if (navigator.serviceWorker.controller) {
                                  console.log('Nova versão encontrada! Recarregando...');
                                  window.location.reload();
                              }
                          }
                      };
                  };
              }).catch((err) => console.error('Erro ao registrar Service Worker:', err));
          });

          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
              if (!refreshing) {
                  window.location.reload();
                  refreshing = true;
              }
          });
      }

let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const btnContainer = document.getElementById('pwa-install-container');
            if (btnContainer) btnContainer.classList.remove('hidden');
        });

        function dispararInstalacaoPWA() {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    document.getElementById('pwa-install-container').classList.add('hidden');
                }
                deferredPrompt = null;
            });
        }

        const CATEGORIAS_PADRAO = ["PESSOAL", "MANUTENÇÃO", "MERCADO", "FARMÁCIA", "OUTRO"];

        const BACKUP_INTERNO_CONSOLIDADO = {
            "saldoAcumulado": 0,
            "historico": [],
            "mesesAnteriores": [],
            "sugestoesGastos": ["MERCADO", "PADARIA", "COMBUSTÍVEL", "FARMÁCIA"],
            "categoriasCustomizadas": ["PESSOAL", "MANUTENÇÃO", "MERCADO", "FARMÁCIA", "OUTRO"]
        };

        let dados = JSON.parse(localStorage.getItem('financeiro_pro'));
        
        if (!dados || !dados.historico) {
            dados = JSON.parse(JSON.stringify(BACKUP_INTERNO_CONSOLIDADO));
            localStorage.setItem('financeiro_pro', JSON.stringify(dados));
        }

        if (!dados.categoriasCustomizadas) {
            dados.categoriasCustomizadas = [...CATEGORIAS_PADRAO];
        }
        
        let itensGastosTemporarios = JSON.parse(localStorage.getItem('rascunho_gastos_dia')) || [];
        let lancamentoEmEdicao = null;

        function parseValor(valor) {
            if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
            let texto = String(valor ?? '').trim().replace(/\s/g, '').replace(/^R\$\s*/i, '');
            if (!texto) return 0;
            if (texto.includes(',') && texto.includes('.')) {
                texto = texto.lastIndexOf(',') > texto.lastIndexOf('.')
                    ? texto.replace(/\./g, '').replace(',', '.')
                    : texto.replace(/,/g, '');
            } else if (texto.includes(',')) {
                texto = texto.replace(',', '.');
            }
            const numero = Number(texto);
            return Number.isFinite(numero) ? numero : 0;
        }

        function paraCentavos(valor) {
            return Math.round(parseValor(valor) * 100);
        }

        function totalItensEmCentavos(itens) {
            return (itens || []).reduce((total, item) => total + paraCentavos(item.valor), 0);
        }

        function formatarMoeda(valor) {
            return parseValor(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        function obtenerDataHoje() {
            return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
        }

        function carregarOpcoesCategorias() {
            const select = document.getElementById('gasto-item-cat');
            select.innerHTML = '';
            
            dados.categoriasCustomizadas.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat.toUpperCase();
                opt.innerText = cat;
                select.appendChild(opt);
            });

            const optNova = document.createElement('option');
            optNova.value = "CADASTRAR_NOVA";
            optNova.innerText = "+ Cadastrar Nova";
            select.appendChild(optNova);
        }

        function verificarSelecaoCategoria() {
            const select = document.getElementById('gasto-item-cat');
            const inputNova = document.getElementById('nova-cat-input');
            if (select.value === "CADASTRAR_NOVA") {
                inputNova.classList.remove('hidden');
                inputNova.focus();
            } else {
                inputNova.classList.add('hidden');
            }
        }

        function verificarTravaDiaria() {
            const hoje = obtenerDataHoje();
            const jaLancado = dados.historico.some(item => item.data === hoje || item.data === hoje.substring(0,5));
            const btnSalvar = document.getElementById('btn-salvar-principal');
            const btnDetalhar = document.getElementById('btn-detalhar');
            const avisoBotao = document.getElementById('aviso-trava-botao');

            if (jaLancado) {
                btnSalvar.innerText = `⚠️ ${hoje.substring(0,5)} JÁ LANÇADO`;
                btnSalvar.className = "w-full bg-yellow-600 text-white font-bold py-3.5 rounded-xl text-sm uppercase tracking-normal cursor-not-allowed";
                btnSalvar.disabled = true;
                btnDetalhar.disabled = true;
                if (avisoBotao) avisoBotao.classList.add('hidden');
                
                ['faturamento', 'renda-extra', 'gasolina', 'guardado-valor'].forEach(id => {
                    document.getElementById(id).disabled = true;
                    document.getElementById(id).className = "input-bloqueado";
                });
            } else {
                btnSalvar.innerText = "Salvar e Fechar o Dia";
                btnSalvar.className = "w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-3.5 rounded-xl text-base shadow-md uppercase tracking-normal";
                btnSalvar.disabled = false;
                btnDetalhar.disabled = false;
                if (avisoBotao) avisoBotao.classList.remove('hidden');
                
                ['faturamento', 'renda-extra', 'gasolina', 'guardado-valor'].forEach(id => {
                    document.getElementById(id).disabled = false;
                    document.getElementById(id).className = "input-autonomo";
                });
            }
        }

        function salvarRascunhoCampos() {
            if (lancamentoEmEdicao !== null) return;
            const rascunho = {
                faturamento: document.getElementById('faturamento').value,
                rendaExtra: document.getElementById('renda-extra').value,
                gasolina: document.getElementById('gasolina').value,
                guardadoValor: document.getElementById('guardado-valor').value
            };
            localStorage.setItem('rascunho_campos_dia', JSON.stringify(rascunho));
        }

        function carregarRascunhoCampos() {
            const rascunho = JSON.parse(localStorage.getItem('rascunho_campos_dia'));
            if (rascunho) {
                document.getElementById('faturamento').value = rascunho.faturamento || '';
                document.getElementById('renda-extra').value = rascunho.rendaExtra || '';
                document.getElementById('gasolina').value = rascunho.gasolina || '';
                document.getElementById('guardado-valor').value = rascunho.guardadoValor || '';
            }
        }

        function atualizarUI() {
            let totalEntradas = 0;
            let totalSaidas = 0;

            dados.historico.forEach(item => {
                totalEntradas += (parseValor(item.faturamento) || 0) + (parseValor(item.rendaExtra) || 0);
                totalSaidas += (parseValor(item.gasolina) || 0) + (parseValor(item.pessoal) || 0);
            });

            dados.mesesAnteriores.forEach(mes => {
                totalEntradas += (parseValor(mes.faturamentoTotal) || 0) + (parseValor(mes.rendaExtraTotal) || 0);
                if (mes.historico) {
                    mes.historico.forEach(h => {
                        totalSaidas += (parseValor(h.gasolina) || 0) + (parseValor(h.pessoal) || 0);
                    });
                }
            });

            // Dinheiro Guardado (Aportes e Resgates)
            let totalDinheiroGuardado = 0;
            dados.historico.forEach(item => { 
                totalDinheiroGuardado += (parseValor(item.guardado) || 0); 
            });
            dados.mesesAnteriores.forEach(mes => {
                if (mes.historico) {
                    mes.historico.forEach(h => { 
                        totalDinheiroGuardado += (parseValor(h.guardado) || 0); 
                    });
                }
            });

            const totalAcumulado = totalEntradas - totalSaidas; 
            const disponivel = totalAcumulado - totalDinheiroGuardado;

            const saldoEl = document.getElementById('saldo-total');
            saldoEl.innerText = formatarMoeda(totalAcumulado);
            saldoEl.className = `text-4xl font-black ${totalAcumulado >= 0 ? 'text-green-500' : 'text-red-500'}`;

            document.getElementById('saldo-guardado-investimento').innerText = formatarMoeda(totalDinheiroGuardado);
            document.getElementById('saldo-disponivel').innerText = formatarMoeda(disponivel);

            // Balanço Período
            let totalFat = 0, totalRenda = 0, totalGas = 0, totalPes = 0, totalGua = 0;
            dados.historico.forEach(item => {
                totalFat += parseValor(item.faturamento) || 0;
                totalRenda += parseValor(item.rendaExtra) || 0;
                totalGas += parseValor(item.gasolina) || 0;
                totalPes += parseValor(item.pessoal) || 0;
                totalGua += parseValor(item.guardado) || 0;
            });

            document.getElementById('total-faturamento').innerText = formatarMoeda(totalFat);
            document.getElementById('total-renda-extra').innerText = formatarMoeda(totalRenda);
            document.getElementById('total-gasolina').innerText = formatarMoeda(totalGas);
            document.getElementById('total-pessoal').innerText = formatarMoeda(totalPes);
            document.getElementById('total-guardado').innerText = formatarMoeda(totalGua);

            if (lancamentoEmEdicao === null) {
                const rascunhoTotalCentavos = totalItensEmCentavos(itensGastosTemporarios);
                document.getElementById('pessoal').value = rascunhoTotalCentavos > 0 ? (rascunhoTotalCentavos / 100).toFixed(2) : '';
            }

            // ÚLTIMO REGISTRO (3 COLUNAS)
            const resumoContainer = document.getElementById('ultimo-resumo-container');
            if (dados.historico.length > 0) {
                const ultimo = dados.historico[dados.historico.length - 1];
                resumoContainer.classList.remove('hidden');
                document.getElementById('last-date').innerText = `${ultimo.data}`;
                const ganhoTotal = (parseValor(ultimo.faturamento) || 0) + (parseValor(ultimo.rendaExtra) || 0);
                const despesaTotal = (parseValor(ultimo.gasolina) || 0) + (parseValor(ultimo.pessoal) || 0);
                const saldoDiaNumerico = ultimo.saldoDia !== undefined && ultimo.saldoDia !== null && ultimo.saldoDia !== '' ? parseValor(ultimo.saldoDia) : null;
                const sdoDia = saldoDiaNumerico !== null ? saldoDiaNumerico : (ganhoTotal - despesaTotal);

                document.getElementById('last-ganho').innerText = formatarMoeda(ganhoTotal);
                document.getElementById('last-gastos').innerText = formatarMoeda(despesaTotal);
                
                const sdoEl = document.getElementById('last-saldo-dia');
                sdoEl.innerText = formatarMoeda(sdoDia);
                sdoEl.className = `font-bold text-[11px] ${sdoDia >= 0 ? 'text-green-400' : 'text-red-400'}`;
            } else {
                resumoContainer.classList.add('hidden');
            }

            // TABELA HISTÓRICO RECENTE
            const tbody = document.getElementById('historico-body');
            tbody.innerHTML = '';
            if (dados.historico.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="p-6 text-center text-gray-600 italic text-xs">Nenhum registro ativo neste mês</td></tr>';
            } else {
                [...dados.historico].reverse().forEach((item, index) => {
                    const idxReal = dados.historico.length - 1 - index;
                    const tr = document.createElement('tr');
                    tr.className = 'border-t border-gray-800 text-xs';
                    const sDia = parseValor(item.saldoDia) || 0;
                    const indPlanilha = (item.detalheGastos && item.detalheGastos.length > 0) ? `<span class="block text-[9px] text-red-500 font-black uppercase mt-0.5">📋 DETALHADO</span>` : '';
                    tr.innerHTML = `
                        <td class="p-3 text-white font-black">${item.data}${indPlanilha}</td>
                        <td class="p-3 font-bold ${sDia >= 0 ? 'text-green-500' : 'text-red-500'}">${formatarMoeda(sDia)}</td>
                        <td class="p-3 text-right"><button onclick="abrirEdicao(${idxReal})" class="text-blue-400 font-bold border-2 border-blue-600 bg-blue-950 px-2.5 py-1 rounded-md text-xs">Ajustar</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // MESES ARQUIVADOS
            const mContainer = document.getElementById('meses-anteriores-container');
            const mVazios = document.getElementById('meses-vazios');
            if (dados.mesesAnteriores.length === 0) {
                mContainer.innerHTML = ''; mVazios.classList.remove('hidden');
            } else {
                mVazios.classList.add('hidden');
                mContainer.innerHTML = dados.mesesAnteriores.map((mes, idx) => {
                    const faturamentoExibido = mes.faturamentoTotal || 0;
                    const liquidoExibido = mes.saldoFinalNoMes !== undefined ? mes.saldoFinalNoMes : 0;
                    return `
                    <div onclick="abrirResumoMesArquivado(${idx})" class="bg-gray-900 p-3 rounded-xl border border-gray-800 flex justify-between items-center text-xs cursor-pointer mb-2">
                        <div>
                            <h4 class="font-bold text-gray-300 uppercase text-[10px] tracking-wider">📅 ${mes.periodo}</h4>
                            <p class="text-gray-400 text-[10px] mt-0.5">Faturamento Total: <span class="text-green-400 font-bold">${formatarMoeda(faturamentoExibido)}</span></p>
                        </div>
                        <div class="text-right flex items-center gap-2" onclick="event.stopPropagation();">
                            <div class="mr-1">
                                <span class="text-[9px] text-gray-500 block uppercase font-bold">Fundo Líquido</span>
                                <span class="font-bold text-blue-400">${formatarMoeda(liquidoExibido)}</span>
                            </div>
                            <button onclick="editarNomeMesAnterior(${idx})" class="text-gray-400 hover:text-white p-1 text-sm">✏️</button>
                            <button onclick="deletarMesAnterior(${idx})" class="text-red-500 p-1 text-sm">🗑️</button>
                        </div>
                    </div>
                `}).join('');
            }
            verificarTravaDiaria();
        }

        function abrirModalTransferencia() {
            document.getElementById('valor-resgate-input').value = '';
            document.getElementById('modal-transferencia').classList.add('active');
        }

        function fecharModalTransferencia() {
            document.getElementById('modal-transferencia').classList.remove('active');
        }

        function confirmarResgate() {
            const valor = parseValor(document.getElementById('valor-resgate-input').value) || 0;
            if (valor <= 0) {
                alert('Digite um valor válido para resgate.');
                return;
            }

            const dataHoje = obtenerDataHoje().substring(0, 5);
            dados.historico.push({
                data: dataHoje,
                faturamento: 0,
                rendaExtra: 0,
                gasolina: 0,
                pessoal: 0,
                guardado: -valor,
                saldoDia: 0,
                detalheGastos: [],
                timestamp: new Date().getTime()
            });

            localStorage.setItem('financeiro_pro', JSON.stringify(dados));
            fecharModalTransferencia();
            atualizarUI();
        }

        function renderizarBaloesDinamicos() {
            const input = document.getElementById('gasto-item-desc').value.trim().toUpperCase();
            const container = document.getElementById('container-sugestoes');
            container.innerHTML = '';

            const listaParaFiltrar = dados.sugestoesGastos || [];
            const baloesFiltrados = input.length === 0 ? listaParaFiltrar.slice(-6).reverse() : listaParaFiltrar.filter(p => p.includes(input));

            baloesFiltrados.forEach(palavra => {
                const span = document.createElement('span');
                span.className = 'sugestao-tag';
                span.innerText = palavra;
                span.onclick = function() {
                    document.getElementById('gasto-item-desc').value = palavra;
                    container.innerHTML = '';
                    document.getElementById('gasto-item-val').focus();
                };
                container.appendChild(span);
            });
        }

        function salvarRascunhoGastos() {
            const contexto = document.getElementById('modo-planilha-contexto').value;
            if (contexto !== 'ajuste') {
                localStorage.setItem('rascunho_gastos_dia', JSON.stringify(itensGastosTemporarios));
            }
        }

        function abrirSubjanelaGastos() {
            carregarOpcoesCategorias();
            document.getElementById('nova-cat-input').classList.add('hidden');
            document.getElementById('modo-planilha-contexto').value = "principal";
            document.getElementById('gasto-item-desc').value = '';
            document.getElementById('gasto-item-val').value = '';
            
            itensGastosTemporarios = JSON.parse(localStorage.getItem('rascunho_gastos_dia')) || [];
            
            document.getElementById('subjanela-gastos').classList.add('active');
            renderizarBaloesDinamicos();
            renderizarListaSubjanela();
        }

        function reabrirPlanilhaNoAjuste() {
            if (lancamentoEmEdicao === null) return;
            carregarOpcoesCategorias();
            document.getElementById('nova-cat-input').classList.add('hidden');
            document.getElementById('modo-planilha-contexto').value = "ajuste";
            const itemOriginal = dados.historico[lancamentoEmEdicao];
            itensGastosTemporarios = itemOriginal.detalheGastos ? [...itemOriginal.detalheGastos] : [];
            document.getElementById('modal-edicao').classList.remove('active');
            document.getElementById('subjanela-gastos').classList.add('active');
            renderizarBaloesDinamicos();
            renderizarListaSubjanela();
        }

        function fecharSubjanelaGastos() {
            document.getElementById('subjanela-gastos').classList.remove('active');
            if (document.getElementById('modo-planilha-contexto').value === "ajuste") {
                document.getElementById('modal-edicao').classList.add('active');
            }
        }

        function adicionarItemNaLista() {
            const selectCat = document.getElementById('gasto-item-cat');
            const inputNovaCat = document.getElementById('nova-cat-input');
            const descEl = document.getElementById('gasto-item-desc');
            const valEl = document.getElementById('gasto-item-val');
            
            let categoria = selectCat.value;
            if (categoria === "CADASTRAR_NOVA") {
                categoria = inputNovaCat.value.trim().toUpperCase();
                if (!categoria) {
                    alert('Digite o nome da nova categoria.');
                    return;
                }
                if (!dados.categoriasCustomizadas.includes(categoria)) {
                    dados.categoriasCustomizadas.push(categoria);
                    localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                }
            }

            const descricao = descEl.value.trim().toUpperCase();
            const valorCentavos = paraCentavos(valEl.value);

            if (!descricao || valorCentavos <= 0) {
                alert('Insira descrição e valor.');
                return;
            }

            itensGastosTemporarios.push({ categoria, descricao, valor: valorCentavos / 100 });
            salvarRascunhoGastos();
            
            carregarOpcoesCategorias();
            selectCat.value = categoria;
            inputNovaCat.value = '';
            inputNovaCat.classList.add('hidden');

            // Limpa somente os campos do próximo lançamento; os itens já adicionados permanecem na lista.
            descEl.value = '';
            valEl.value = '';
            renderizarBaloesDinamicos();
            renderizarListaSubjanela();
            descEl.focus();
        }

        function removerItemDaLista(index) {
            itensGastosTemporarios.splice(index, 1);
            salvarRascunhoGastos();
            renderizarListaSubjanela();
        }

        function renderizarListaSubjanela() {
            const tBody = document.getElementById('lista-gastos-correntes-body');
            tBody.innerHTML = '';
            const totalCentavos = totalItensEmCentavos(itensGastosTemporarios);
            itensGastosTemporarios.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.className = 'border-t border-gray-800 text-xs';
                tr.innerHTML = `
                    <td class="p-2 text-gray-400 font-bold uppercase text-[10px]">${item.categoria || 'OUTRO'}</td>
                    <td class="p-2 text-gray-300 uppercase">${item.descricao}</td>
                    <td class="p-2 text-white font-bold">${formatarMoeda(item.valor)}</td>
                    <td class="p-2 text-right"><button onclick="removerItemDaLista(${index})" class="text-red-500 font-bold px-1">✕</button></td>
                `;
                tBody.appendChild(tr);
            });
            document.getElementById('subjanela-total-acumulado').innerText = formatarMoeda(totalCentavos / 100);
        }

        function salvarSubjanelaGastos() {
            const totalCentavos = totalItensEmCentavos(itensGastosTemporarios);
            const totalCalculado = totalCentavos / 100;
            const contexto = document.getElementById('modo-planilha-contexto').value;

            itensGastosTemporarios.forEach(i => {
                if (dados.sugestoesGastos && !dados.sugestoesGastos.includes(i.descricao)) {
                    dados.sugestoesGastos.push(i.descricao);
                }
            });

            if (contexto === 'ajuste') {
                document.getElementById('edit-pessoal').value = totalCalculado.toFixed(2);
                if (lancamentoEmEdicao !== null && dados.historico[lancamentoEmEdicao]) {
                    dados.historico[lancamentoEmEdicao].detalheGastos = itensGastosTemporarios.map(item => ({ ...item }));
                    dados.historico[lancamentoEmEdicao].pessoal = totalCalculado;
                    dados.historico[lancamentoEmEdicao].saldoDia = (
                        parseValor(dados.historico[lancamentoEmEdicao].faturamento) +
                        parseValor(dados.historico[lancamentoEmEdicao].rendaExtra) -
                        parseValor(dados.historico[lancamentoEmEdicao].gasolina) -
                        totalCalculado
                    );
                }
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                document.getElementById('subjanela-gastos').classList.remove('active');
                document.getElementById('modal-edicao').classList.add('active');
            } else {
                document.getElementById('pessoal').value = totalCentavos > 0 ? totalCalculado.toFixed(2) : '';
                localStorage.setItem('rascunho_gastos_dia', JSON.stringify(itensGastosTemporarios));
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                document.getElementById('subjanela-gastos').classList.remove('active');
            }
            atualizarUI();
        }

        /* FLUXO DE CONFIRMAÇÃO DO FECHAMENTO DO DIA */
        function confirmarFechamentoDia(event) {
            if (event) event.preventDefault();
            document.getElementById('modal-confirmar-dia').classList.add('active');
        }

        function fecharModalConfirmarDia() {
            document.getElementById('modal-confirmar-dia').classList.remove('active');
        }

        function executarSalvarDia() {
            fecharModalConfirmarDia();

            const faturamento = parseValor(document.getElementById('faturamento').value) || 0;
            const rendaExtra = parseValor(document.getElementById('renda-extra').value) || 0;
            const gasolina = parseValor(document.getElementById('gasolina').value) || 0;
            const pessoal = parseValor(document.getElementById('pessoal').value) || 0;
            const guardado = parseValor(document.getElementById('guardado-valor').value) || 0;

            const saldoDia = (faturamento + rendaExtra) - gasolina - pessoal;

            const dataHojeCompleta = obtenerDataHoje();
            const dataDiaMesCurta = dataHojeCompleta.substring(0, 5);

            dados.historico.push({
                data: dataDiaMesCurta,
                faturamento, rendaExtra, gasolina, pessoal, 
                guardado,
                saldoDia,
                detalheGastos: [...itensGastosTemporarios],
                timestamp: new Date().getTime()
            });

            localStorage.setItem('financeiro_pro', JSON.stringify(dados));

            ['faturamento', 'renda-extra', 'gasolina', 'pessoal', 'guardado-valor'].forEach(id => {
                document.getElementById(id).value = '';
            });
            itensGastosTemporarios = [];
            localStorage.removeItem('rascunho_gastos_dia');
            localStorage.removeItem('rascunho_campos_dia');

            atualizarUI();
        }

        function auditarCategoria(propriedade, nomeExibicao) {
            const tituloEl = document.getElementById('auditoria-titulo');
            const tbodyEl = document.getElementById('lista-auditoria-body');
            const totalEl = document.getElementById('auditoria-total-acumulado');
            
            tituloEl.innerText = `Conferência: ${nomeExibicao}`;
            tbodyEl.innerHTML = '';
            
            let acumuloTotal = 0;
            
            if (propriedade === 'pessoal') {
                const resumoPorCategoria = {};
                let totalCentavos = 0;

                dados.historico.forEach(item => {
                    if (item.detalheGastos && item.detalheGastos.length > 0) {
                        item.detalheGastos.forEach(g => {
                            const categoria = (g.categoria || 'OUTRO').trim().toUpperCase();
                            const valorCentavos = paraCentavos(g.valor);
                            resumoPorCategoria[categoria] = (resumoPorCategoria[categoria] || 0) + valorCentavos;
                            totalCentavos += valorCentavos;
                        });
                    } else {
                        // Compatibilidade com lançamentos antigos que não tinham planilha detalhada.
                        const valorCentavos = paraCentavos(item.pessoal);
                        if (valorCentavos > 0) {
                            resumoPorCategoria.OUTRO = (resumoPorCategoria.OUTRO || 0) + valorCentavos;
                            totalCentavos += valorCentavos;
                        }
                    }
                });

                Object.keys(resumoPorCategoria).sort().forEach(categoria => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-t border-gray-800 text-xs linha-auditoria-clicavel cursor-pointer';
                    tr.onclick = () => abrirDetalheGastosPorCategoria(categoria);
                    tr.innerHTML = `<td class="p-2.5 text-gray-300 uppercase font-bold">${categoria}</td><td class="p-2.5 text-right font-bold text-red-400">${formatarMoeda(resumoPorCategoria[categoria] / 100)}</td>`;
                    tbodyEl.appendChild(tr);
                });

                acumuloTotal = totalCentavos / 100;
            } else {
                dados.historico.forEach(item => {
                    const v = parseValor(item[propriedade]) || 0;
                    if (v !== 0) {
                        acumuloTotal += v;
                        const tr = document.createElement('tr');
                        tr.className = 'border-t border-gray-800 text-xs';
                        tr.innerHTML = `<td class="p-2.5 text-gray-300">${item.data}</td><td class="p-2.5 text-right font-bold">${formatarMoeda(v)}</td>`;
                        tbodyEl.appendChild(tr);
                    }
                });
            }
            totalEl.innerText = formatarMoeda(acumuloTotal);
            document.getElementById('subjanela-auditoria').classList.add('active');
        }

        function fecharSubjanelaAuditoria() { document.getElementById('subjanela-auditoria').classList.remove('active'); }

        function abrirDetalheGastosPorCategoria(categoriaSelecionada) {
            const categoriaNormalizada = (categoriaSelecionada || 'OUTRO').trim().toUpperCase();
            document.getElementById('item-detalhe-selecionado').value = categoriaNormalizada;
            document.getElementById('detalhe-titulo').innerText = `Detalhes: ${categoriaNormalizada}`;
            document.getElementById('detalhe-subtitulo').innerText = 'Lançamentos individuais da categoria';

            const tbodyEl = document.getElementById('detalhe-gastos-body');
            tbodyEl.innerHTML = '';
            let totalCentavos = 0;

            dados.historico.forEach(item => {
                if (item.detalheGastos && item.detalheGastos.length > 0) {
                    item.detalheGastos.forEach(g => {
                        const categoria = (g.categoria || 'OUTRO').trim().toUpperCase();
                        if (categoria === categoriaNormalizada) {
                            const valorCentavos = paraCentavos(g.valor);
                            totalCentavos += valorCentavos;
                            const tr = document.createElement('tr');
                            tr.className = 'border-t border-gray-800 text-xs';
                            tr.innerHTML = `<td class="p-2.5 text-gray-300">${item.data}</td><td class="p-2.5 text-gray-300 uppercase">${g.descricao}</td><td class="p-2.5 text-right font-bold text-red-400">${formatarMoeda(valorCentavos / 100)}</td>`;
                            tbodyEl.appendChild(tr);
                        }
                    });
                } else if (categoriaNormalizada === 'OUTRO' && paraCentavos(item.pessoal) > 0) {
                    const valorCentavos = paraCentavos(item.pessoal);
                    totalCentavos += valorCentavos;
                    const tr = document.createElement('tr');
                    tr.className = 'border-t border-gray-800 text-xs';
                    tr.innerHTML = `<td class="p-2.5 text-gray-300">${item.data}</td><td class="p-2.5 text-gray-300 uppercase">Lançamento antigo</td><td class="p-2.5 text-right font-bold text-red-400">${formatarMoeda(valorCentavos / 100)}</td>`;
                    tbodyEl.appendChild(tr);
                }
            });

            document.getElementById('detalhe-total-acumulado').innerText = formatarMoeda(totalCentavos / 100);
            document.getElementById('subjanela-auditoria').classList.remove('active');
            document.getElementById('modal-detalhe-gastos').classList.add('active');
        }

        // Compatibilidade com chamadas antigas que ainda possam existir em dados ou interface.
        function abrirDetalheGastos(categoria) {
            abrirDetalheGastosPorCategoria(categoria);
        }

        function fecharDetalheGastos() { document.getElementById('modal-detalhe-gastos').classList.remove('active'); }
        function voltarParaAuditoria() {
            document.getElementById('modal-detalhe-gastos').classList.remove('active');
            document.getElementById('subjanela-auditoria').classList.add('active');
        }

        function abrirFecharMes() {
            if (dados.historico.length === 0) { alert('Histórico atual está vazio.'); return; }
            const dPartida = dados.historico[0].data.split('/');
            const mesesStr = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
            let idxMes = parseInt(dPartida[1]) - 1;
            
            document.getElementById('input-nome-mes-fechamento').value = `${mesesStr[idxMes]} DE 2026`;
            document.getElementById('modal-fechar-mes').classList.add('active');
        }
        function fecharModalMes() { document.getElementById('modal-fechar-mes').classList.remove('active'); }

        function confirmarFecharMes() {
            const labelMes = document.getElementById('input-nome-mes-fechamento').value.trim().toUpperCase();
            if (!labelMes) { alert('Digite um nome para o período.'); return; }

            try {
                const backupDataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados));
                const gatilhoDownload = document.createElement('a');
                gatilhoDownload.setAttribute("href", backupDataStr);
                gatilhoDownload.setAttribute("download", `FECHADO_${labelMes.replace(/ /g, '_')}.txt`);
                gatilhoDownload.click();
            } catch (err) { console.error(err); }

            let fat = 0, renda = 0, gas = 0, pes = 0, gua = 0;
            let descritivoCompilado = {};

            dados.historico.forEach(item => {
                fat += parseValor(item.faturamento) || 0;
                renda += parseValor(item.rendaExtra) || 0;
                gas += parseValor(item.gasolina) || 0;
                pes += parseValor(item.pessoal) || 0;
                gua += parseValor(item.guardado) || 0;

                if (item.detalheGastos) {
                    item.detalheGastos.forEach(g => {
                        const cat = g.categoria || 'OUTRO';
                        const dUpper = g.descricao.toUpperCase();
                        const chave = `[${cat}] ${dUpper}`;
                        descritivoCompilado[chave] = (descritivoCompilado[chave] || 0) + parseValor(g.valor);
                    });
                }
            });

            let listaDescritivoFinal = Object.keys(descritivoCompilado).map(k => ({
                descricao: k, valor: descritivoCompilado[k]
            }));

            const saldoFinalNoMes = (fat + renda) - gas - pes;

            dados.mesesAnteriores.push({
                periodo: labelMes,
                faturamentoTotal: fat, rendaExtraTotal: renda, pessoalTotal: pes, guardadoTotal: gua,
                saldoFinalNoMes,
                descritivoGastos: listaDescritivoFinal,
                historico: [...dados.historico]
            });

            dados.historico = [];
            localStorage.setItem('financeiro_pro', JSON.stringify(dados));
            fecharModalMes(); 
            atualizarUI();
        }

        function abrirResumoMesArquivado(index) {
            const mes = dados.mesesAnteriores[index];
            document.getElementById('mes-arq-titulo').innerText = mes.periodo;
            
            const fatExibido = mes.faturamentoTotal !== undefined ? mes.faturamentoTotal : (mes.totalFaturamento || 0);
            const rendaExibida = mes.rendaExtraTotal || 0;
            const liqExibido = mes.saldoFinalNoMes !== undefined ? mes.saldoFinalNoMes : (mes.saldoFinal || 0);
            
            document.getElementById('mes-arq-fat').innerText = formatarMoeda(fatExibido);
            document.getElementById('mes-arq-renda').innerText = formatarMoeda(rendaExibida);
            
            let gas = 0, gua = 0;
            if (mes.historico) {
                mes.historico.forEach(h => {
                    gas += parseValor(h.gasolina) || 0;
                    gua += parseValor(h.guardado) || 0;
                });
            }

            document.getElementById('mes-arq-gas').innerText = formatarMoeda(gas);
            document.getElementById('mes-arq-guardado').innerText = formatarMoeda(gua);
            document.getElementById('mes-arq-pessoal').innerText = formatarMoeda(mes.pessoalTotal || mes.pessoal || 0);
            document.getElementById('mes-arq-saldo-final').innerText = formatarMoeda(liqExibido);

            const container = document.getElementById('mes-arq-descritivo-container');
            container.innerHTML = '';
            
            const listaDeGastos = mes.descritivoGastos || [];
            if (listaDeGastos.length > 0) {
                listaDeGastos.forEach(g => {
                    container.innerHTML += `<div class="flex justify-between py-0.5 border-b border-gray-900"><span class="uppercase">${g.descricao}</span><span class="font-bold text-red-400">${formatarMoeda(g.valor)}</span></div>`;
                });
            } else {
                container.innerHTML = `<div class="text-gray-600 text-[10px] italic text-center">Sem descritivo de despesas detalhado.</div>`;
            }

            document.getElementById('subjanela-mes-aquivado').classList.add('active');
        }

        function fecharSubjanelaMesArquivado() { document.getElementById('subjanela-mes-aquivado').classList.remove('active'); }

        function editarNomeMesAnterior(index) {
            const novoNome = prompt("Ajustar nome do período arquivado:", dados.mesesAnteriores[index].periodo);
            if (novoNome && novoNome.trim() !== "") {
                dados.mesesAnteriores[index].periodo = novoNome.trim().toUpperCase();
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                atualizarUI();
            }
        }

        function abrirEdicao(index) {
            lancamentoEmEdicao = index; const item = dados.historico[index];
            document.getElementById('edit-data').value = item.data;
            document.getElementById('edit-faturamento').value = item.faturamento;
            document.getElementById('edit-renda-extra').value = item.rendaExtra;
            document.getElementById('edit-gasolina').value = item.gasolina;
            document.getElementById('edit-pessoal').value = item.pessoal;
            document.getElementById('edit-guardado').value = item.guardado || 0;
            document.getElementById('modal-edicao').classList.add('active');
        }

        function fecharModal() { 
            document.getElementById('modal-edicao').classList.remove('active'); 
            lancamentoEmEdicao = null; 
            itensGastosTemporarios = JSON.parse(localStorage.getItem('rascunho_gastos_dia')) || [];
            atualizarUI();
        }
        
        function salvarEdicao() {
            if (lancamentoEmEdicao === null) return;
            const item = dados.historico[lancamentoEmEdicao];
            item.faturamento = parseValor(document.getElementById('edit-faturamento').value) || 0;
            item.rendaExtra = parseValor(document.getElementById('edit-renda-extra').value) || 0;
            item.gasolina = parseValor(document.getElementById('edit-gasolina').value) || 0;
            item.pessoal = parseValor(document.getElementById('edit-pessoal').value) || 0;
            item.guardado = parseValor(document.getElementById('edit-guardado').value) || 0;
            
            item.saldoDia = (item.faturamento + item.rendaExtra) - item.gasolina - item.pessoal;
            
            localStorage.setItem('financeiro_pro', JSON.stringify(dados));
            fecharModal(); atualizarUI();
        }

        function deletarLancamento() {
            if (confirm('Deletar registro deste dia?')) {
                dados.historico.splice(lancamentoEmEdicao, 1);
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                fecharModal(); atualizarUI();
            }
        }

        function deletarMesAnterior(index) {
            if (confirm('Deseja realmente excluir este mês arquivado?')) {
                dados.mesesAnteriores.splice(index, 1);
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                atualizarUI();
            }
        }

        function limparDados() {
            if (confirm('Zerar o aplicativo inteiro?')) {
                dados = { saldoAcumulado: 0, historico: [], mesesAnteriores: [], sugestoesGastos: [], categoriasCustomizadas: [...CATEGORIAS_PADRAO] };
                itensGastosTemporarios = [];
                localStorage.removeItem('rascunho_gastos_dia');
                localStorage.removeItem('rascunho_campos_dia');
                localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                atualizarUI();
            }
        }
        
        function exportarBackup() {
            const agora = new Date();
            const dia = String(agora.getDate()).padStart(2, '0');
            const mes = String(agora.getMonth() + 1).padStart(2, '0');
            const ano = agora.getFullYear();
            const horas = String(agora.getHours()).padStart(2, '0');
            const minutes = String(agora.getMinutes()).padStart(2, '0');
            const dataHoraFormatada = `${dia}-${mes}-${ano}_${horas}h${minutes}`;
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dados));
            const dl = document.createElement('a'); dl.setAttribute("href", dataStr);
            dl.setAttribute("download", `backup_financeiro_${dataHoraFormatada}.txt`); dl.click();
        }
        
        function importarBackup(event) {
            const reader = new FileReader();
            reader.onload = function() {
                try {
                    const backupBruto = JSON.parse(reader.result);
                    if (backupBruto && (backupBruto.historico || backupBruto.mesesAnteriores)) {
                        localStorage.removeItem('financeiro_pro');
                        dados = backupBruto;
                        if (!dados.categoriasCustomizadas) {
                            dados.categoriasCustomizadas = [...CATEGORIAS_PADRAO];
                        }
                        itensGastosTemporarios = [];
                        localStorage.removeItem('rascunho_gastos_dia');
                        localStorage.removeItem('rascunho_campos_dia');
                        localStorage.setItem('financeiro_pro', JSON.stringify(dados));
                        atualizarUI();
                        alert('Backup restaurado com sucesso!');
                    } else { alert('Formato de arquivo inválido.'); }
                } catch (e) { alert('Erro no arquivo de backup.'); }
            };
            if (event.target.files.length > 0) reader.readAsText(event.target.files[0]);
        }

        carregarRascunhoCampos();
        atualizarUI();

        // Listeners para auto-salvamento dos campos
        ['faturamento', 'renda-extra', 'gasolina', 'guardado-valor'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', salvarRascunhoCampos);
        });

