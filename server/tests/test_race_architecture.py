import json
import subprocess
from pathlib import Path

import pytest

from server.game import Arena, CONFIG, OBSTACLES, TOWER_TRACKS, TOWER_STRUCTURES, support_height, boxes_at, segment_obstacle


def test_rendered_architecture_and_server_share_every_solid_volume():
    source = "import {towerObstacles} from './shared/tower.js'; console.log(JSON.stringify(towerObstacles));"
    result = subprocess.run(['node','--input-type=module','-e',source],cwd=Path(__file__).parents[2],check=True,capture_output=True,text=True)
    rendered = json.loads(result.stdout)
    assert len(rendered) == len(OBSTACLES)
    for client, (server, _) in zip(rendered, OBSTACLES):
        for field in ('x','z','h','w','d'):
            assert client[field] == pytest.approx(server[field])
        assert client.get('thickness',client['h']) == pytest.approx(server.get('thickness',server['h']))


@pytest.mark.parametrize('style', ['bed','domino','tea-tray','book','clock','inverted-house'])
def test_architecture_supports_landings_and_its_faces_are_solid(style):
    arena = Arena(seed=1, mode='race')
    p = arena.join('Escalador')
    arena.players = {p.id:p}
    deck = next(o for o in TOWER_TRACKS[0] if o['style'] == style)
    p.x, p.y, p.z = deck['x'], deck['h']+.2, deck['z']
    p.grounded, p.vy = False, -1
    for _ in range(12):
        arena.step(.05)
        if p.grounded:
            break
    assert p.grounded and p.y == pytest.approx(deck['h'])
    assert not arena.can_move(deck['x'],deck['z'],deck['h']-.2)


def test_connecting_canals_are_physical_supports():
    assert len(TOWER_STRUCTURES) > 20
    for span in TOWER_STRUCTURES:
        assert support_height(span['x'],span['z'],span['h'],boxes_at(0)) == pytest.approx(span['h'])


def test_course_expands_into_rooms_with_nonuniform_steps_and_round_landings():
    track=TOWER_TRACKS[1]
    assert CONFIG['race']['bounds']['width']>3*CONFIG['width']
    assert max(p['x'] for p in track)>80 and max(p['z'] for p in track)>60
    assert len({round(b['h']-a['h'],2) for a,b in zip(track,track[1:])})>=5
    assert sum(p.get('shape')=='ellipse' for p in track)>20
    assert any(o['w']>=70 and o['d']>=30 for o in TOWER_STRUCTURES)


def test_round_cups_have_no_invisible_solid_square_corners():
    deck=next(p for p in TOWER_TRACKS[1] if p['style']=='tea-tray')
    arena=Arena(mode='race')
    x,z=deck['x']+deck['w']*.49,deck['z']+deck['d']*.49
    assert support_height(x,z,deck['h'])<deck['h']
    assert arena.can_move(x,z,deck['h']-.5)
    assert not arena.can_move(deck['x'],deck['z'],deck['h']-.5)
    bottom=deck['h']-deck['thickness']; y=deck['h']-.5
    assert segment_obstacle((x,y,z),(x+.1,y,z+.1),deck,bottom,deck['h']) is None
    assert segment_obstacle((deck['x']-deck['w'],y,deck['z']),
                            (deck['x']+deck['w'],y,deck['z']),deck,bottom,deck['h'])==pytest.approx(.25)


def test_height_does_not_guess_progress_and_bounds_are_specific_to_each_mode():
    arena=Arena(mode='race');p=arena.join('Mesa')
    board=next(o for o in TOWER_TRACKS[p.team] if o['style']=='chessboard')
    p.x,p.y,p.z=board['x'],board['h'],board['z'];p.grounded=True
    arena.check_finish()
    assert p.race_step==board['step']
    assert arena.can_move(100,75,0)
    assert not Arena().can_move(100,75,0)
