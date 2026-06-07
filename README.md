# Atualizações para o README

## Estrutura da Planilha

A planilha deverá conter as seguintes colunas:

| Coluna      |
| ----------- |
| Código      |
| Data        |
| Família     |
| Espécie     |
| Local       |
| Coordenadas |
| Observação  |

### Exemplo de Registro

| Código  | Data       | Família   | Espécie                       | Local      | Coordenadas            | Observação                         |
| ------- | ---------- | --------- | ----------------------------- | ---------- | ---------------------- | ---------------------------------- |
| CC00019 | 12/04/2025 | PENAEIDAE | Penaeus (Farfantepenaeus) sp. | Maceió, AL | 9°34'22"S / 35°46'40"W | Comprado na loja Universo Submerso |

---

# Filtros

Todos os filtros devem ser gerados dinamicamente a partir dos dados presentes na planilha carregada.

As opções disponíveis devem ser recalculadas sempre que uma nova planilha for importada.

## Data

Filtro por intervalo de datas.

### Campos

* Data inicial
* Data final

---

## Família

### Tipo

Seleção múltipla (Multi Select)

### Comportamento

* Permitir selecionar uma ou várias famílias.
* Possuir busca interna quando houver muitas opções.
* Exibir quantidade de registros encontrados após aplicação dos filtros.

Exemplo:

* PENAEIDAE
* PORTUNIDAE
* OCYPODIDAE

---

## Espécie

### Tipo

Seleção múltipla (Multi Select)

### Comportamento

* Permitir selecionar uma ou várias espécies.
* Possuir busca interna.
* Exibir lista ordenada alfabeticamente.

Exemplo:

* Penaeus (Farfantepenaeus) sp.
* Callinectes danae
* Ucides cordatus

---

## Local

### Tipo

Seleção múltipla (Multi Select)

### Comportamento

* Permitir selecionar um ou vários locais.
* Lista construída automaticamente a partir da planilha.

Exemplo:

* Maceió, AL
* Marechal Deodoro, AL
* Paripueira, AL
* Barra de São Miguel, AL

---

## Observação

### Tipo

Busca textual

### Comportamento

Filtro por texto livre.

Exemplos:

* Comprado
* Mercado
* Universo Submerso

A busca deve ignorar diferenças entre maiúsculas e minúsculas.

---

# Regras de Aplicação dos Filtros

Todos os filtros devem funcionar simultaneamente.

Exemplo:

* Data entre 01/01/2025 e 31/12/2025
* Família = PENAEIDAE
* Espécie = Penaeus (Farfantepenaeus) sp.
* Local = Maceió, AL

Resultado:

* mapa atualizado
* estatísticas atualizadas
* tabela atualizada

---

# Tratamento de Coordenadas

## Formato Recebido

As coordenadas da planilha serão fornecidas em formato DMS (Graus, Minutos e Segundos).

Exemplo:

```text
9°34'22"S / 35°46'40"W
```

---

## Conversão Obrigatória

O sistema deverá converter automaticamente as coordenadas para formato decimal antes da renderização no mapa.

Exemplo:

```text
9°34'22"S / 35°46'40"W
↓
-9.572778, -35.777778
```

---

## Utilitário

Criar um módulo específico para conversão:

```text
src/utils/parseCoordinates.ts
```

Responsabilidades:

* Ler coordenadas DMS
* Converter para decimal
* Validar formatos inválidos
* Retornar latitude e longitude prontas para uso no Leaflet

---

# Mapa

## Biblioteca

* Leaflet
* React Leaflet
* Leaflet Heat

---

## Fonte dos Dados

Utilizar as coordenadas convertidas da coluna:

```text
Coordenadas
```

---

## Heatmap

Cada registro da planilha representa uma ocorrência.

A intensidade do heatmap deverá aumentar de acordo com a concentração de ocorrências em uma determinada região.

Quanto maior o número de registros próximos, maior a intensidade exibida.

---

## Modos de Visualização

### Heatmap

Visualização principal.

Exibir concentração de ocorrências.

### Marcadores Individuais

Visualização auxiliar para validação dos dados.

Cada registro será exibido como um marcador individual.

Objetivo:

* verificar coordenadas
* validar importação
* identificar erros de localização

---

## Alternância

Adicionar botão:

```text
Heatmap
Marcadores
```

Permitindo alternar entre os dois modos.

---

# Estatísticas

Exibir:

## Resumo

* Total de registros filtrados
* Total de famílias encontradas
* Total de espécies encontradas
* Total de locais encontrados

## Distribuição

* Registros por família
* Registros por espécie
* Registros por local

---

# Tabela de Resultados

Exibir todos os registros filtrados.

Colunas:

* Código
* Data
* Família
* Espécie
* Local
* Coordenadas
* Observação

Funcionalidades:

* Ordenação
* Paginação
* Busca rápida
* Exportação

---

# Melhorias de UX

## Filtros

Adicionar:

* Limpar filtros
* Selecionar todos
* Remover seleção
* Contador de itens selecionados

Exemplo:

```text
Família (3 selecionadas)
Espécie (12 selecionadas)
Local (2 selecionados)
```

---

## Upload

Ao carregar nova planilha:

* limpar filtros atuais
* recalcular opções dos filtros
* recalcular estatísticas
* atualizar mapa automaticamente

---

# MVP (Versão Inicial)

A primeira versão deverá conter:

* Upload de Excel (.xlsx, .xls, .csv)
* Conversão automática de coordenadas DMS
* Filtro por período
* Filtro de Família (multiselect)
* Filtro de Espécie (multiselect)
* Filtro de Local (multiselect)
* Filtro de Observação (texto)
* Heatmap
* Visualização por marcadores
* Estatísticas básicas
* Tabela de resultados
* Exportação CSV
* Interface responsiva
* Tema claro
* Execução local
