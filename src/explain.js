// Textes pédagogiques des écrans de jet et de combat (ticket 99). Uniquement de la mise
// en forme : aucune règle ici, tout est relu dans le snapshot ou recalculé avec les
// fonctions de gameLogic.js, exactement comme le serveur.
import { HIT_LOCATIONS, characteristicLabel, degreeLabel, effectiveSkillScore } from './gameLogic.js'

// Même lecture que parseMalus (server/game.js) : « +10 » retire 10 au seuil.
export function malusValue(malus) {
  if (!malus) return 0
  const n = parseInt(String(malus).replace('+', ''), 10)
  return Number.isFinite(n) ? n : 0
}

// Un malus s'affiche avec un signe moins : « +10 » laissait croire à un bonus.
export function malusDisplay(malus) {
  const n = malusValue(malus)
  return n ? `-${n}` : ''
}

export const DICE_RULE =
  'On lance un dé à 100 faces. Le jet réussit si le résultat est inférieur ou égal au seuil. Chaque tranche de 10 points d’écart donne un degré de réussite ou d’échec en plus.'

// Seuil d'un test ordonné, avant le jet : même calcul que rollForCharacter (server/routes.js).
export function testThreshold(character, skillName, linkedCharacteristic, malus) {
  if (!character || !skillName) return null
  const trained = character.skills.some((s) => s.name === skillName)
  const score = effectiveSkillScore(character, skillName, linkedCharacteristic)
  const m = malusValue(malus)
  return {
    skill: skillName,
    score,
    trained,
    characteristic: linkedCharacteristic || null,
    characteristicName: linkedCharacteristic ? characteristicLabel(linkedCharacteristic) : null,
    characteristicValue: linkedCharacteristic ? character.characteristics?.[linkedCharacteristic] ?? 0 : 0,
    malus: m,
    target: Math.max(0, score - m),
  }
}

// « de l'Agilité », « de la Force » : le libellé complet se lit mieux avec son article.
function withArticle(name) {
  if (!name) return ''
  return /^[AEIOUÉÈH]/i.test(name) ? `l’${name}` : `la ${name}`
}

// Ligne de calcul en petit sous les chiffres : d'où vient le seuil.
export function thresholdCalcText(t) {
  if (!t) return ''
  const base = t.trained
    ? `${t.skill} ${t.score}${t.characteristicName ? `, liée à ${withArticle(t.characteristicName)}` : ''}`
    : `${t.skill} non apprise : la moitié de ${withArticle(t.characteristicName || 'caractéristique')} (${t.characteristicValue}), soit ${t.score}`
  return t.malus ? `${base}, moins un malus de ${t.malus} = seuil de ${t.target}` : `${base} = seuil de ${t.target}`
}

function degreesShort(degrees) {
  return `${degrees} degré${degrees > 1 ? 's' : ''}`
}

// « Réussite, 2 degrés » et « 34 sur un seuil de 45 » pour une ligne de résultat.
export function rollSummary(r) {
  if (!r) return null
  const isSuccess = r.status === 'success'
  return {
    isSuccess,
    title: `${isSuccess ? 'Réussite' : 'Échec'}, ${degreesShort(r.degrees)}`,
    detail: r.roll != null && r.target != null ? `${r.roll} sur un seuil de ${r.target}` : '',
  }
}

// Phrase d'explication sous le titre d'un résultat : l'écart et ce qu'il donne.
export function rollGapText(roll, target) {
  if (roll == null || target == null) return ''
  const gap = Math.abs(target - roll)
  const points = `${gap} point${gap > 1 ? 's' : ''}`
  if (roll <= target) {
    return gap === 0 ? `Votre dé fait ${roll}, pile le seuil : c’est réussi.` : `Votre dé fait ${roll}, soit ${points} sous le seuil : c’est réussi.`
  }
  return `Votre dé fait ${roll}, soit ${points} au dessus du seuil : c’est raté.`
}

// Étape de la séquence de combat (1 jet d'attaque, 2 esquive, 3 dégâts).
export function attackStep(attack) {
  if (!attack) return 0
  if (attack.outcome === 'pending-attack-roll' || attack.outcome === 'miss') return 1
  if (attack.outcome === 'pending-dodge' || attack.outcome === 'dodged') return 2
  return 3
}

export const ATTACK_STEPS = ['jet d’attaque', 'esquive', 'dégâts']

export function bulletsText(attack) {
  if (!attack) return ''
  if (attack.fireMode === 'melee') return 'Le coup touche'
  const bullets = attack.bullets || 1
  return bullets > 1 ? `${bullets} balles touchent` : '1 balle touche'
}

// Titre principal du résultat d'une attaque, vu par la cible.
export function attackResultTitle(attack, pvCurrent) {
  if (!attack) return ''
  if (attack.outcome === 'miss') return 'L’attaque vous a manqué'
  if (attack.outcome === 'dodged') return 'Esquive réussie : aucun dégât'
  if (attack.outcome === 'hit' && attack.damage) {
    const dmg = `${attack.damage.totalDamage} dégât${attack.damage.totalDamage > 1 ? 's' : ''} subi${attack.damage.totalDamage > 1 ? 's' : ''}`
    return pvCurrent != null && pvCurrent <= 0 ? `Hors de combat : ${dmg}` : `Esquive ratée : ${dmg}`
  }
  return ''
}

// Résultat découpé en éléments distincts (exigence 9) plutôt qu'une phrase longue.
// `tone` : 'ok' (bon pour la cible), 'ko' (mauvais pour elle) ou null.
export function attackOutcomeFacts(attack, pv) {
  if (!attack) return []
  const facts = []
  if (attack.outcome === 'miss') {
    facts.push({ key: 'attaque', label: 'Attaque', value: `Ratée, ${degreeLabel(attack.degrees, false)}`, tone: 'ok' })
    return facts
  }
  facts.push({ key: 'attaque', label: 'Attaque', value: `Touché, ${degreesShort(attack.degrees)}`, tone: 'ko' })
  if (attack.outcome === 'dodged') {
    facts.push({ key: 'esquive', label: 'Esquive', value: `Réussie, ${degreeLabel(attack.dodgeDegrees, true)}`, tone: 'ok' })
    return facts
  }
  if (attack.outcome !== 'hit' || !attack.damage) return facts
  facts.push({ key: 'esquive', label: 'Esquive', value: `Ratée, ${degreeLabel(attack.dodgeDegrees, false)}`, tone: 'ko' })
  facts.push({ key: 'localisation', label: 'Localisation', value: attack.damage.locationLabel, tone: null })
  facts.push({ key: 'balles', label: attack.fireMode === 'melee' ? 'Coup' : 'Balles', value: bulletsText(attack), tone: null })
  facts.push({ key: 'degats', label: 'Dégâts subis, armure déduite', value: String(attack.damage.totalDamage), tone: 'ko' })
  if (pv) facts.push({ key: 'pv', label: 'Points de vie restants', value: `${pv.current} sur ${pv.max}`, tone: pv.current <= 0 ? 'ko' : null })
  return facts
}

// Grille d'armure par localisation, dans l'ordre de la table de localisation.
export function armorCells(armor, hitLocationKey) {
  return HIT_LOCATIONS.map((l) => {
    const value = armor?.[l.key] || 0
    return { key: l.key, label: l.label, value, isEmpty: value === 0, isHit: l.key === hitLocationKey }
  })
}

// « test d’Esquive », « test de Vigilance ».
export function testOf(skill) {
  if (!skill) return 'test'
  return /^[AEIOUYÉÈH]/i.test(skill) ? `test d’${skill}` : `test de ${skill}`
}

// Phrase de récapitulatif au pied de la modale « Ordonner un test ».
export function launchSummary({ skill, malus, count, fictionalCount }) {
  if (!skill) return 'Choisissez une compétence.'
  const test = testOf(skill)
  const Test = test.charAt(0).toUpperCase() + test.slice(1)
  if (!count) return `${Test} : aucun joueur choisi.`
  const m = malusValue(malus)
  const who = `${count} joueur${count > 1 ? 's' : ''}${fictionalCount ? ` dont ${fictionalCount} fictif${fictionalCount > 1 ? 's' : ''}` : ''}`
  return `${Test}${m ? `, malus de ${m}` : ', sans malus'}, pour ${who}.`
}
