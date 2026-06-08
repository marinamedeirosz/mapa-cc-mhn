# Mapa CC MNH

Facilitador para visualização da representatividade espacial de coleções carcinológicas.

O **Mapa CC MNH** ajuda a transformar registros de uma coleção carcinológica em uma leitura espacial clara. A partir de uma planilha, o sistema organiza os dados, posiciona as ocorrências no mapa e permite observar onde a coleção está mais ou menos representada.

O projeto foi pensado para apoiar pesquisadores, curadores e demais pessoas interessadas na coleção, sem exigir conhecimento técnico em programação ou geoprocessamento. Em vez de analisar manualmente muitas linhas de uma planilha, a pessoa usuária pode importar os dados e explorar mapas, filtros, estatísticas e tabelas interativas.

## Como o projeto funciona

A aplicação roda no navegador e faz a leitura da planilha localmente. Ao importar um arquivo `.xlsx`, `.xls` ou `.csv`, o sistema lê a primeira aba, identifica as colunas esperadas e transforma cada linha em um registro da coleção.

Depois da importação, cada registro passa por uma etapa de interpretação espacial:

1. Se a coluna `Coordenadas` possui um valor válido, o sistema usa essa posição.
2. Se a coordenada está ausente ou inválida, o sistema tenta reconhecer a coluna `Local` em uma base offline de localidades conhecidas.
3. Se não for possível encontrar uma posição, o registro continua disponível na tabela e nas estatísticas, mas fica fora do mapa.

Coordenadas em graus, minutos e segundos são convertidas automaticamente para o formato decimal, usado por mapas digitais. O sistema também reconhece pares decimais quando eles já vêm nesse formato.

## Tradução da planilha para os mapas

A planilha é a fonte principal dos dados. O sistema espera informações como código, data, família, espécie, local, coordenadas e observação. Durante a leitura, os cabeçalhos são normalizados, então diferenças de acentos, letras maiúsculas, minúsculas ou espaços extras são toleradas.

Quando há coordenadas válidas, o registro é posicionado diretamente no mapa. Quando não há, o projeto usa uma base local com nomes e variações comuns de localidades de Alagoas, mantida no arquivo [`src/data/localCoordinates.ts`](src/data/localCoordinates.ts). Essa base cobre exemplos como Jaraguá, Ponta Verde, Pajuçara, Pontal do Peba, Morro de Camaragibe, Carro Quebrado, Porto da Rua e outros locais já mapeados.

Registros associados ao **Complexo Estuarino-Lagunar Mundaú-Manguaba (CELMM)** recebem um tratamento especial. Quando o local menciona CELMM, Mundaú ou Manguaba, o registro é interpretado como parte desse complexo. No mapa municipal, esses dados são distribuídos entre os municípios relacionados: Maceió, Marechal Deodoro, Coqueiro Seco, Pilar, Rio Largo, Santa Luzia do Norte e Satuba.

## Funcionalidades

- Importação local de planilhas `.xlsx`, `.xls` e `.csv`.
- Leitura da primeira aba da planilha.
- Normalização de cabeçalhos e correção de textos importados.
- Conversão automática de coordenadas para latitude e longitude.
- Posicionamento por coordenadas ou por localidade conhecida.
- Avisos para registros com data, coordenada ou local não reconhecidos.
- Filtros por data, família, espécie, local e observação.
- Estatísticas dos registros filtrados.
- Tabela com ordenação, paginação, busca rápida e exportação CSV.
- Mapa de pontos para visualizar concentração de ocorrências.
- Mapa municipal de Alagoas com cores por quantidade de registros.
- Detalhamento dos registros ao clicar em municípios ou métricas.
- Exportação do mapa municipal em PNG.

## Estrutura esperada da planilha

A planilha deve conter estas colunas:

| Coluna |
| --- |
| Código |
| Data |
| Família |
| Espécie |
| Local |
| Coordenadas |
| Observação |

Exemplo:

| Código | Data | Família | Espécie | Local | Coordenadas | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| CC00019 | 12/04/2025 | PENAEIDAE | Penaeus sp. | Maceió, AL | 9°34'22"S / 35°46'40"W | Comprado na loja Universo Submerso |

## Visualizações

### Mapa de pontos

Mostra a concentração de ocorrências que possuem posição geográfica, seja por coordenadas da planilha ou pela identificação do local.

### Mapa por municípios

Mostra a malha municipal de Alagoas. Cada município recebe uma cor de acordo com a quantidade de registros associados a ele. Quanto maior a contagem, mais intensa é a cor.

Nesse modo, é possível mostrar ou ocultar nomes de municípios, clicar em um município para ver os registros que compõem a contagem e exportar o mapa em PNG. Quando muitos nomes ficarem próximos, o mapa usa etiquetas laterais com linhas tracejadas para conectar a etiqueta ao município correspondente.

## Filtros e resultados

Os filtros são recalculados a partir da planilha importada e atualizam automaticamente mapa, estatísticas e tabela. É possível filtrar por intervalo de datas, família, espécie, local e texto em observações.

A tabela de resultados mantém todos os registros importados, inclusive aqueles que não puderam ser posicionados no mapa. Ela permite busca rápida, ordenação, paginação e exportação dos dados filtrados em CSV.

## Desenvolvimento

Instale as dependências:

```bash
pnpm install
```

Rode o app localmente:

```bash
pnpm dev
```

Comandos de verificação:

```bash
pnpm test
pnpm lint
pnpm build
```

## Tecnologias

- React
- Vite
- TypeScript
- Tailwind CSS
- Componentes estilo shadcn/ui
- SheetJS (`xlsx`)
- Leaflet, React Leaflet e Leaflet Heat
- TanStack Table
- Vitest
