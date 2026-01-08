/**
 * Schémas de validation avec Zod
 * Valide les données entrantes pour éviter les erreurs et injections
 */

import { z } from 'zod';

// ================================================
// SCHÉMAS DE BASE
// ================================================

export const idSchema = z.string().uuid('ID invalide');

export const dateSchema = z.string().datetime('Date invalide').or(z.date());

export const emailSchema = z.string().email('Email invalide');

export const phoneSchema = z.string().regex(
    /^(\+33|0)[1-9](\d{2}){4}$/,
    'Numéro de téléphone invalide'
);

export const zoneSchema = z.enum(['FR', 'GP', 'MQ', 'CORSE', 'RE', 'YT', 'GF'], {
    errorMap: () => ({ message: 'Zone invalide' })
});

export const statusSchema = z.string().min(1, 'Statut requis');

// ================================================
// SCHÉMAS CLIENT
// ================================================

export const clientSchema = z.object({
    nom: z.string().min(1, 'Nom requis').max(100, 'Nom trop long'),
    prenom: z.string().min(1, 'Prénom requis').max(100, 'Prénom trop long'),
    adresse: z.string().optional(),
    ville: z.string().optional(),
    code_postal: z.string().optional(),
    telephone: phoneSchema.optional(),
    email: emailSchema.optional(),
    nb_led: z.number().int().positive('Nombre de LEDs invalide').optional(),
    zone_pays: zoneSchema.optional(),
    statut_client: statusSchema.optional(),
    statut_livraison: statusSchema.optional(),
    statut_installation: statusSchema.optional(),
});

export const updateClientSchema = clientSchema.partial();

// ================================================
// SCHÉMAS LIVRAISON
// ================================================

export const deliverySchema = z.object({
    client_id: idSchema,
    date_livraison_prevue: dateSchema,
    heure_livraison: z.string().regex(/^\d{2}:\d{2}$/, 'Heure invalide (format HH:MM)').optional(),
    livreur_id: z.string().optional(),
    statut_livraison: statusSchema.optional(),
});

export const confirmDeliverySchema = z.object({
    client_id: idSchema,
    date_livraison_reelle: dateSchema,
    signature_livraison: z.string().optional(),
    commentaire: z.string().max(500, 'Commentaire trop long').optional(),
});

// ================================================
// SCHÉMAS INSTALLATION
// ================================================

export const installationSchema = z.object({
    client_id: idSchema,
    date_install_debut: dateSchema,
    date_install_fin: dateSchema.optional(),
    poseur_id: z.string().optional(),
    statut_installation: statusSchema.optional(),
});

export const updateInstallationSchema = z.object({
    client_id: idSchema,
    date_install_fin: dateSchema.optional(),
    statut_installation: statusSchema.optional(),
    commentaire: z.string().max(500).optional(),
});

// ================================================
// SCHÉMAS STOCK
// ================================================

export const stockUpdateSchema = z.object({
    zone: zoneSchema,
    quantite: z.number().int().positive('Quantité invalide'),
});

export const stockQuerySchema = z.object({
    zone: zoneSchema,
});

// ================================================
// SCHÉMAS RAPPORTS
// ================================================

export const reportQuerySchema = z.object({
    type: z.enum(['deliveries', 'installations', 'stock'], {
        errorMap: () => ({ message: 'Type de rapport invalide' })
    }),
    format: z.enum(['pdf', 'excel'], {
        errorMap: () => ({ message: 'Format invalide' })
    }),
    dateRange: z.enum(['all', 'today', 'week', 'month']).optional(),
    zone: zoneSchema.optional(),
});

// ================================================
// SCHÉMAS ANALYTICS
// ================================================

export const analyticsEventSchema = z.object({
    event_name: z.string().min(1).max(100),
    event_category: z.string().min(1).max(50),
    event_properties: z.record(z.any()).optional(),
    session_id: z.string().optional(),
});

// ================================================
// SCHÉMAS VROOM
// ================================================

export const vroomOptimizeSchema = z.object({
    jobs: z.array(z.object({
        id: z.number(),
        location: z.array(z.number()).length(2),
        service: z.number().optional(),
        delivery: z.array(z.number()).optional(),
        pickup: z.array(z.number()).optional(),
        skills: z.array(z.number()).optional(),
    })).min(1).max(200),
    vehicles: z.array(z.object({
        id: z.number(),
        profile: z.string().optional(),
        start: z.array(z.number()).length(2).optional(),
        end: z.array(z.number()).length(2).optional(),
        capacity: z.array(z.number()).optional(),
        skills: z.array(z.number()).optional(),
        time_window: z.array(z.number()).length(2).optional(),
    })).min(1).max(20)
});

// ================================================
// MIDDLEWARE DE VALIDATION
// ================================================

/**
 * Crée un middleware de validation pour un schéma Zod
 */
export function validate(schema, source = 'body') {
    return (req, res, next) => {
        try {
            const data = source === 'body' ? req.body :
                source === 'query' ? req.query :
                    source === 'params' ? req.params :
                        req.body;

            const validated = schema.parse(data);

            // Remplacer les données par les données validées sans écraser l'objet conteneur (qui peut être en lecture seule)
            if (source === 'body') {
                Object.keys(req.body).forEach(key => delete req.body[key]);
                Object.assign(req.body, validated);
            }
            else if (source === 'query') {
                // req.query est souvent un objet null-prototype, attention.
                for (const key in req.query) delete req.query[key];
                Object.assign(req.query, validated);
            }
            else if (source === 'params') {
                for (const key in req.params) delete req.params[key];
                Object.assign(req.params, validated);
            }

            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Données invalides',
                    details: error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }))
                });
            }
            next(error);
        }
    };
}

/**
 * Validation asynchrone
 */
export async function validateAsync(schema, data) {
    try {
        return {
            success: true,
            data: await schema.parseAsync(data)
        };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                errors: error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            };
        }
        throw error;
    }
}

// ================================================
// EXEMPLES D'UTILISATION
// ================================================

/*
// Dans une route Express :

import { validate, clientSchema, deliverySchema } from './validation.js';

// Valider le body
app.post('/api/clients', validate(clientSchema), (req, res) => {
  // req.body est maintenant validé et typé
  const client = req.body;
  // ...
});

// Valider les query params
app.get('/api/stock', validate(stockQuerySchema, 'query'), (req, res) => {
  // req.query est validé
  const { zone } = req.query;
  // ...
});

// Validation asynchrone
const result = await validateAsync(clientSchema, data);
if (!result.success) {
  return res.status(400).json({ errors: result.errors });
}
*/
