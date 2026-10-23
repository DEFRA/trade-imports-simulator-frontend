import Blankie from 'blankie'

/**
 * Manage content security policies.
 * @satisfies {import('@hapi/hapi').Plugin}
 */
const contentSecurityPolicy = {
  plugin: Blankie,
  options: {
    defaultSrc: ['self'],
    connectSrc: ['self'],
    imgSrc: ['self', 'data:'],
    mediaSrc: ['self'],
    fontSrc: ['self', 'data:'],
    objectSrc: ['none'],
    scriptSrc: ['self'],
    styleSrc: ['self'],
    frameAncestors: ['none'],
    formAction: ['self'],
    manifestSrc: ['self'],
    generateNonces: true
  }
}

export { contentSecurityPolicy }
