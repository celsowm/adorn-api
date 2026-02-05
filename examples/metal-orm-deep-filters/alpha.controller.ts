import {
  Controller,
  Get,
  Query,
  Returns,
  parseFilter,
  parsePagination,
  withSession,
  type RequestContext
} from "../../src";
import {
  applyFilter,
  entityRef,
  selectFromEntity,
  toPagedResponse,
  type WhereInput
} from "metal-orm";
import { createSession } from "./db";
import { Alpha } from "./alpha.entity";
import { AlphaPagedResponseDto, AlphaQueryDto } from "./alpha.dtos";

const alphaRef = entityRef(Alpha);

const ALPHA_FILTER_MAPPINGS = {
  deltaNameContains: {
    field: "bravos.some.charlies.some.delta.name",
    operator: "contains"
  },
  charlieScoreGte: {
    field: "bravos.some.charlies.some.score",
    operator: "gte"
  },
  deltaMissing: {
    field: "bravos.some.charlies.some.delta",
    operator: "isEmpty"
  }
} as const;

@Controller("/alphas")
export class AlphaController {
  @Get("/")
  @Query(AlphaQueryDto)
  @Returns(AlphaPagedResponseDto)
  async list(ctx: RequestContext<unknown, AlphaQueryDto>) {
    return withSession(createSession, async (session) => {
      const { page, pageSize } = parsePagination(
        (ctx.query ?? {}) as Record<string, unknown>
      );
      const filters = parseFilter(
        (ctx.query ?? {}) as Record<string, unknown>,
        ALPHA_FILTER_MAPPINGS
      ) as WhereInput<typeof Alpha> | undefined;

      const query = applyFilter(
        selectFromEntity(Alpha)
          .orderBy(alphaRef.id, "ASC")
          .include("bravos", {
            include: {
              charlies: {
                include: {
                  delta: true
                }
              }
            }
          }),
        Alpha,
        filters
      );

      const paged = await query.executePaged(session, { page, pageSize });
      return toPagedResponse(paged);
    });
  }
}
