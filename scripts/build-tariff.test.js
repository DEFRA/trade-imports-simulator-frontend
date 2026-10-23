import { buildTree } from './build-tariff.js'

const header =
  '"id","commodity__sid","commodity__code","commodity__suffix","commodity__description","commodity__validity_start","commodity__validity_end","parent__sid","parent__code","parent__suffix"'

// Rows shaped like the tariff's own: a chapter, a heading under a suffix-10 label, a code the tariff
// re-issued (two rows in force), an expired code, and descriptions with the tariff's markup.
const csv = [
  header,
  '1,1,"0100000000","80","LIVE ANIMALS","1971-12-31","#NA","#NA","#NA","#NA"',
  '2,2,"0101210000","10","Horses","2012-01-01","#NA",1,"0100000000","80"',
  '3,3,"0101210000","80","Pure-bred<br>breeding animals","2012-01-01","#NA",2,"0101210000","10"',
  '4,4,"0101300000","80","Asses","2012-01-01","#NA",1,"0100000000","80"',
  '5,5,"0101300000","80","Asses, old","2000-01-01","2011-12-31",1,"0100000000","80"',
  '6,6,"2207100011","80","Ethyl alcohol, old SID","2019-07-01","#NA",1,"0100000000","80"',
  '7,7,"2207100011","80","Ethyl alcohol","2023-09-16","#NA",1,"0100000000","80"',
  '8,8,"2207100019","80","With:\n- a weight of|78 kg/m<sup>3</sup>","2012-08-25","#NA",6,"2207100011","80"'
].join('\n')

describe('#buildTree', () => {
  const [chapter] = buildTree(csv)
  const [horses, asses, alcohol] = chapter[3]

  test('Should nest codes under their parents, with only declarable leaves pickable', () => {
    expect(chapter.slice(0, 3)).toEqual(['0100000000', 'LIVE ANIMALS', 0])
    expect(asses).toEqual(['0101300000', 'Asses', 1, []])
  })

  test('Should turn a heading with another suffix into a label, so codes stay unique', () => {
    expect(horses.slice(0, 3)).toEqual([null, 'Horses', 0])
    expect(horses[3]).toEqual([
      ['0101210000', 'Pure-bred breeding animals', 1, []]
    ])
  })

  test('Should leave out codes no longer in force', () => {
    expect(chapter[3].filter((node) => node[0] === '0101300000')).toHaveLength(
      1
    )
  })

  test("Should keep the newer of a re-issued code's rows, with the older one's children", () => {
    expect(chapter[3]).toHaveLength(3)
    expect(alcohol.slice(0, 3)).toEqual(['2207100011', 'Ethyl alcohol', 0])
    expect(alcohol[3][0][0]).toBe('2207100019')
  })

  test("Should turn the tariff's markup into plain text", () => {
    expect(alcohol[3][0][1]).toBe('With: - a weight of 78 kg/m3')
  })
})
